-- ============================================================================
-- Edufy Academy: transactional email outbox (queue + logs), automatic email events,
-- and credential slots for Google OAuth and the Supabase "Send Email" hook.
-- Safe to re-run.
--
-- Emails are queued here (idempotent per event_key) and sent by the Express server's worker
-- (SMTP / Resend / Brevo) with retries. Database events enqueue emails through triggers that can
-- never block the original action (sign-up, enrollment, certificate, course completion).
-- ============================================================================

-- ---------------------------------------------------------------- credential providers
ALTER TABLE public.secure_credentials DROP CONSTRAINT IF EXISTS secure_credentials_provider_check;
ALTER TABLE public.secure_credentials ADD CONSTRAINT secure_credentials_provider_check
  CHECK (provider IN ('razorpay', 'email', 'emovur', 'google', 'auth_hook'));

-- ---------------------------------------------------------------- email_outbox
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE CHECK (char_length(event_key) BETWEEN 3 AND 200),
  template text NOT NULL CHECK (template ~ '^[a-z_]{3,40}$'),
  to_email text NOT NULL CHECK (to_email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' AND char_length(to_email) <= 254),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vars jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(vars) = 'object'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  priority smallint NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  provider text,
  provider_response text CHECK (provider_response IS NULL OR char_length(provider_response) <= 500),
  message_id text,
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_outbox_due_idx ON public.email_outbox (status, next_attempt_at, priority);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON public.email_outbox (created_at DESC);
CREATE INDEX IF NOT EXISTS email_outbox_user_idx ON public.email_outbox (user_id);
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM anon, authenticated;
GRANT SELECT ON public.email_outbox TO authenticated;
DROP POLICY IF EXISTS "Admins read email outbox" ON public.email_outbox;
CREATE POLICY "Admins read email outbox" ON public.email_outbox FOR SELECT USING (public.is_admin());

-- Queue helper used by triggers (never raises; duplicate event keys are ignored)
CREATE OR REPLACE FUNCTION public.enqueue_email(p_template text, p_user uuid, p_to text, p_key text, p_vars jsonb DEFAULT '{}'::jsonb, p_priority smallint DEFAULT 5)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_to IS NULL OR p_to !~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' THEN RETURN; END IF;
  INSERT INTO public.email_outbox (event_key, template, to_email, user_id, vars, priority)
  VALUES (left(p_key, 200), p_template, lower(p_to), p_user, coalesce(p_vars, '{}'::jsonb), p_priority)
  ON CONFLICT (event_key) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_email(%) failed: %', p_template, SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_email(text, uuid, text, text, jsonb, smallint) FROM PUBLIC, anon, authenticated;

-- Worker claim: due rows → 'sending' (FOR UPDATE SKIP LOCKED, so several server copies never double-send).
-- Rows stuck in 'sending' for 10+ minutes (server crashed mid-send) go back to the queue.
CREATE OR REPLACE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 10)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_outbox SET status = 'queued', locked_at = NULL, updated_at = now()
   WHERE status = 'sending' AND locked_at < now() - interval '10 minutes';
  RETURN QUERY
  UPDATE public.email_outbox o
     SET status = 'sending', locked_at = now(), attempts = o.attempts + 1, updated_at = now()
   WHERE o.id IN (
     SELECT id FROM public.email_outbox
      WHERE status = 'queued' AND next_attempt_at <= now()
      ORDER BY priority, created_at
      LIMIT greatest(1, least(p_limit, 50))
      FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_email_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(integer) TO service_role;

-- ---------------------------------------------------------------- automatic email events
-- 1) Welcome: when an account becomes confirmed (email verified, or Google sign-up which is confirmed at once).
--    Keyed by user id → at most one welcome email per account, however often the user signs in.
CREATE OR REPLACE FUNCTION public.email_on_user_confirmed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM public.enqueue_email(
    'welcome', NEW.id, NEW.email, 'welcome:' || NEW.id::text,
    jsonb_build_object(
      'student_name', coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), nullif(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
      'provider', coalesce(NEW.raw_app_meta_data->>'provider', 'email')
    ));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_on_user_confirmed failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.email_on_user_confirmed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_email_welcome ON auth.users;
CREATE TRIGGER on_auth_user_email_welcome
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.email_on_user_confirmed();

-- 2) Enrollment without a payment (free course, admin grant). Paid enrollments are covered by the
--    purchase confirmation the server sends after verifying the payment → no duplicate emails.
CREATE OR REPLACE FUNCTION public.email_on_enrollment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  c record;
BEGIN
  IF NEW.status <> 'active' OR NEW.payment_id IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN RETURN NEW; END IF;
  SELECT email, full_name INTO p FROM public.profiles WHERE id = NEW.user_id;
  SELECT id, title INTO c FROM public.courses WHERE id = NEW.course_id;
  PERFORM public.enqueue_email('enrollment', NEW.user_id, p.email, 'enrollment:' || NEW.user_id::text || ':' || NEW.course_id,
    jsonb_build_object('student_name', p.full_name, 'course_name', c.title, 'course_id', NEW.course_id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_on_enrollment failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.email_on_enrollment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enrollments_email ON public.enrollments;
CREATE TRIGGER enrollments_email AFTER INSERT OR UPDATE OF status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.email_on_enrollment();

-- 3) Certificate issued
CREATE OR REPLACE FUNCTION public.email_on_certificate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT email, full_name INTO p FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.enqueue_email('certificate', NEW.user_id, p.email, 'certificate:' || NEW.id::text,
    jsonb_build_object('student_name', coalesce(NEW.student_name, p.full_name), 'course_name', NEW.course_title, 'certificate_code', NEW.certificate_code));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_on_certificate failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.email_on_certificate() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS certificates_email ON public.certificates;
CREATE TRIGGER certificates_email AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.email_on_certificate();

-- 4) Course completed (reuses the notification the push system already creates once per course)
CREATE OR REPLACE FUNCTION public.email_on_course_completion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  c record;
BEGIN
  IF NEW.category <> 'course_completion' OR NEW.course_id IS NULL THEN RETURN NEW; END IF;
  SELECT email, full_name INTO p FROM public.profiles WHERE id = NEW.user_id;
  SELECT title INTO c FROM public.courses WHERE id = NEW.course_id;
  PERFORM public.enqueue_email('course_completion', NEW.user_id, p.email, 'completion:' || NEW.user_id::text || ':' || NEW.course_id,
    jsonb_build_object('student_name', p.full_name, 'course_name', c.title, 'course_id', NEW.course_id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_on_course_completion failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.email_on_course_completion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS user_notifications_completion_email ON public.user_notifications;
CREATE TRIGGER user_notifications_completion_email AFTER INSERT ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.email_on_course_completion();
