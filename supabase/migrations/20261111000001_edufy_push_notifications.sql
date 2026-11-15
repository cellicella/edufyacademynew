-- ============================================================================
-- Edufy Academy — push notifications, notification centre, banners & offers
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- Sending is done by the Express server (service role); students only read/update
-- their own rows, admins manage campaigns, banners and offers.
-- ============================================================================

-- ---------------------------------------------------------------- banners
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://[^\s]+$'),
  link_type text NOT NULL DEFAULT 'none' CHECK (link_type IN ('none', 'course', 'bundle', 'offer', 'url')),
  course_id text REFERENCES public.courses(id) ON DELETE SET NULL,
  bundle_id text REFERENCES public.bundles(id) ON DELETE SET NULL,
  offer_id uuid,
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://[^\s]+$'),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banners_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT banners_link CHECK (
    (link_type = 'course' AND course_id IS NOT NULL) OR (link_type = 'bundle' AND bundle_id IS NOT NULL) OR
    (link_type = 'offer' AND offer_id IS NOT NULL) OR (link_type = 'url' AND link_url IS NOT NULL) OR link_type = 'none'
  )
);
CREATE INDEX IF NOT EXISTS banners_active_idx ON public.banners (is_active, position);

-- ---------------------------------------------------------------- offers
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  discount_text text CHECK (discount_text IS NULL OR char_length(discount_text) <= 60),
  offer_type text NOT NULL DEFAULT 'special' CHECK (offer_type IN ('special', 'limited_time', 'festival', 'bundle_discount', 'course_discount', 'campaign')),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://[^\s]+$'),
  link_type text NOT NULL DEFAULT 'none' CHECK (link_type IN ('none', 'course', 'bundle', 'url')),
  course_id text REFERENCES public.courses(id) ON DELETE SET NULL,
  bundle_id text REFERENCES public.bundles(id) ON DELETE SET NULL,
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://[^\s]+$'),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_dates CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT offers_link CHECK (
    (link_type = 'course' AND course_id IS NOT NULL) OR (link_type = 'bundle' AND bundle_id IS NOT NULL) OR
    (link_type = 'url' AND link_url IS NOT NULL) OR link_type = 'none'
  )
);
CREATE INDEX IF NOT EXISTS offers_window_idx ON public.offers (is_active, starts_at, ends_at);

DO $$ BEGIN
  ALTER TABLE public.banners ADD CONSTRAINT banners_offer_fk FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- devices (Expo push tokens)
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^Expo(nent)?PushToken\[[^\]\s]{8,200}\]$'),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  device_name text CHECK (device_name IS NULL OR char_length(device_name) <= 120),
  app_version text CHECK (app_version IS NULL OR char_length(app_version) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  invalid_reason text
);
CREATE INDEX IF NOT EXISTS push_devices_user_idx ON public.push_devices (user_id) WHERE invalidated_at IS NULL;

-- ---------------------------------------------------------------- per-student preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  promotions boolean NOT NULL DEFAULT true,       -- special offers, discounts, campaigns
  new_courses boolean NOT NULL DEFAULT true,      -- new course announcements
  bundles_offers boolean NOT NULL DEFAULT true,   -- new bundles and bundle offers
  announcements boolean NOT NULL DEFAULT true,    -- important announcements, custom admin messages
  learning_updates boolean NOT NULL DEFAULT true, -- course updates, new content, completion, certificates
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- campaigns (admin-created or automatic)
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 65),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 240),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://[^\s]+$'),
  action_url text CHECK (action_url IS NULL OR action_url ~ '^(https://[^\s]+|/[A-Za-z0-9/_\-\(\)\?=&%.]*)$'),
  category text NOT NULL CHECK (category IN (
    'new_course', 'new_bundle', 'offer', 'discount', 'course_update', 'new_content',
    'announcement', 'custom', 'course_completion', 'certificate')),
  course_id text REFERENCES public.courses(id) ON DELETE SET NULL,
  bundle_id text REFERENCES public.bundles(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT 'all_students' CHECK (audience IN ('all_students', 'enrolled_students', 'course_students', 'bundle_buyers')),
  audience_course_id text REFERENCES public.courses(id) ON DELETE SET NULL,
  audience_bundle_id text REFERENCES public.bundles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_course', 'auto_bundle', 'offer')),
  source_key text UNIQUE,              -- idempotency: auto 'course:<id>', manual 'manual:<client key>'
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  cancelled_at timestamptz,
  target_count integer NOT NULL DEFAULT 0,   -- students in the audience (after preferences)
  inbox_count integer NOT NULL DEFAULT 0,    -- notification-centre records created
  device_count integer NOT NULL DEFAULT 0,   -- devices a push was attempted to
  tickets_ok integer NOT NULL DEFAULT 0,     -- accepted by Expo Push Service
  tickets_failed integer NOT NULL DEFAULT 0,
  receipts_ok integer NOT NULL DEFAULT 0,    -- handed to FCM/APNs (Expo receipt "ok")
  receipts_failed integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  CONSTRAINT push_audience_course CHECK (audience <> 'course_students' OR audience_course_id IS NOT NULL),
  CONSTRAINT push_audience_bundle CHECK (audience <> 'bundle_buyers' OR audience_bundle_id IS NOT NULL),
  CONSTRAINT push_schedule CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS push_notifications_due_idx ON public.push_notifications (status, scheduled_at);
CREATE INDEX IF NOT EXISTS push_notifications_created_idx ON public.push_notifications (created_at DESC);

-- ---------------------------------------------------------------- per-device send log (tickets & receipts)
CREATE TABLE IF NOT EXISTS public.push_tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  push_notification_id uuid REFERENCES public.push_notifications(id) ON DELETE CASCADE,
  user_notification_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.push_devices(id) ON DELETE SET NULL,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'error')),
  ticket_id text,
  error text,
  receipt_status text CHECK (receipt_status IS NULL OR receipt_status IN ('ok', 'error')),
  receipt_error text,
  receipt_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One attempt per device per campaign / direct notification: a resumed send never pushes the
-- same device twice (NULLs are distinct, so campaign rows and direct rows don't collide).
DROP INDEX IF EXISTS public.push_tickets_once;
DROP INDEX IF EXISTS public.push_tickets_once_direct;
DO $$ BEGIN
  ALTER TABLE public.push_tickets ADD CONSTRAINT push_tickets_campaign_token UNIQUE (push_notification_id, token);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.push_tickets ADD CONSTRAINT push_tickets_direct_token UNIQUE (user_notification_id, token);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS push_tickets_receipts_idx ON public.push_tickets (status, receipt_status, created_at);

-- ---------------------------------------------------------------- student notification centre
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notification_id uuid REFERENCES public.push_notifications(id) ON DELETE SET NULL,
  dedupe_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  action_url text,
  category text NOT NULL,
  course_id text,
  bundle_id text,
  offer_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_notifications_once UNIQUE (user_id, dedupe_key)
);
-- Direct (per-student) notifications that still need a push: 'pending' → 'sent' | 'failed' | 'skipped'
ALTER TABLE public.user_notifications ADD COLUMN IF NOT EXISTS push_status text
  CHECK (push_status IS NULL OR push_status IN ('pending', 'sent', 'failed', 'skipped'));
CREATE INDEX IF NOT EXISTS user_notifications_push_pending_idx ON public.user_notifications (created_at) WHERE push_status = 'pending';
CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx ON public.user_notifications (user_id) WHERE read_at IS NULL;

-- Items that have already been announced automatically (once per course/bundle, ever)
CREATE TABLE IF NOT EXISTS public.push_announced (
  source_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- automation settings (non-secret)
INSERT INTO public.platform_settings (key, value)
VALUES ('push_notifications', '{"auto_course_enabled": true, "auto_bundle_enabled": true, "auto_requires_review": false, "auto_audience": "all_students", "auto_delay_minutes": 2}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================ RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_announced ENABLE ROW LEVEL SECURITY; -- no policies: server/trigger only

-- Banners / offers: everyone sees only what is live right now; admins manage everything
DROP POLICY IF EXISTS "Live banners are public" ON public.banners;
CREATE POLICY "Live banners are public" ON public.banners FOR SELECT USING (
  (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())) OR public.is_admin()
);
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Live offers are public" ON public.offers;
CREATE POLICY "Live offers are public" ON public.offers FOR SELECT USING (
  (is_active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) OR public.is_admin()
);
DROP POLICY IF EXISTS "Admins manage offers" ON public.offers;
CREATE POLICY "Admins manage offers" ON public.offers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Devices: students see/remove their own; registration goes through register_push_device()
DROP POLICY IF EXISTS "Students read own devices" ON public.push_devices;
CREATE POLICY "Students read own devices" ON public.push_devices FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students remove own devices" ON public.push_devices;
CREATE POLICY "Students remove own devices" ON public.push_devices FOR DELETE USING (auth.uid() = user_id);

-- Preferences: own row only
DROP POLICY IF EXISTS "Students read own preferences" ON public.notification_preferences;
CREATE POLICY "Students read own preferences" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students create own preferences" ON public.notification_preferences;
CREATE POLICY "Students create own preferences" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students update own preferences" ON public.notification_preferences;
CREATE POLICY "Students update own preferences" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Campaigns & send logs: admins read; writes happen on the server (service role)
DROP POLICY IF EXISTS "Admins read campaigns" ON public.push_notifications;
CREATE POLICY "Admins read campaigns" ON public.push_notifications FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins read push tickets" ON public.push_tickets;
CREATE POLICY "Admins read push tickets" ON public.push_tickets FOR SELECT USING (public.is_admin());

-- Notification centre: students read, mark read and delete only their own records
DROP POLICY IF EXISTS "Students read own notifications" ON public.user_notifications;
CREATE POLICY "Students read own notifications" ON public.user_notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students update own notifications" ON public.user_notifications;
CREATE POLICY "Students update own notifications" ON public.user_notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students delete own notifications" ON public.user_notifications;
CREATE POLICY "Students delete own notifications" ON public.user_notifications FOR DELETE USING (auth.uid() = user_id);

-- Students may only change read_at (not the title/body/links of a notification)
REVOKE UPDATE ON public.user_notifications FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;
REVOKE INSERT ON public.user_notifications FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.push_devices FROM anon, authenticated;
REVOKE ALL ON public.push_notifications, public.push_tickets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.push_notifications, public.push_tickets FROM authenticated;

-- ============================================================================ functions
-- Register (or move) this device's Expo push token to the signed-in student.
-- Moving a token handles account switching on a shared phone.
CREATE OR REPLACE FUNCTION public.register_push_device(p_token text, p_platform text, p_device_name text DEFAULT NULL, p_app_version text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000'; END IF;
  IF p_token IS NULL OR p_token !~ '^Expo(nent)?PushToken\[[^\]\s]{8,200}\]$' THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;
  IF p_platform NOT IN ('android', 'ios') THEN RAISE EXCEPTION 'Invalid platform' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.push_devices (user_id, token, platform, device_name, app_version)
  VALUES (uid, p_token, p_platform, left(p_device_name, 120), left(p_app_version, 40))
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, device_name = EXCLUDED.device_name,
    app_version = EXCLUDED.app_version, updated_at = now(), last_seen_at = now(),
    invalidated_at = NULL, invalid_reason = NULL;

  -- Keep at most 10 devices per student (oldest removed)
  DELETE FROM public.push_devices WHERE id IN (
    SELECT id FROM public.push_devices WHERE user_id = uid ORDER BY last_seen_at DESC OFFSET 10
  );
END $$;

CREATE OR REPLACE FUNCTION public.unregister_push_device(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_devices WHERE token = p_token AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.register_push_device(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_device(text) TO authenticated;

-- Which preference switch governs a category
CREATE OR REPLACE FUNCTION public.push_pref_column(p_category text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_category = 'new_course' THEN 'new_courses'
    WHEN p_category = 'new_bundle' THEN 'bundles_offers'
    WHEN p_category IN ('offer', 'discount') THEN 'promotions'
    WHEN p_category IN ('course_update', 'new_content', 'course_completion', 'certificate') THEN 'learning_updates'
    ELSE 'announcements'
  END;
$$;

-- Audience → student ids, honouring each student's preferences (server only)
CREATE OR REPLACE FUNCTION public.push_audience(p_audience text, p_course_id text, p_bundle_id text, p_category text)
RETURNS TABLE (user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT p.id AS user_id FROM public.profiles p WHERE p_audience = 'all_students' AND p.role = 'student'
    UNION
    SELECT e.user_id FROM public.enrollments e WHERE p_audience = 'enrolled_students' AND e.status IN ('active', 'completed')
    UNION
    SELECT e.user_id FROM public.enrollments e WHERE p_audience = 'course_students' AND e.course_id = p_course_id AND e.status IN ('active', 'completed')
    UNION
    SELECT e.user_id FROM public.enrollments e WHERE p_audience = 'bundle_buyers' AND e.bundle_id = p_bundle_id AND e.status IN ('active', 'completed')
  )
  SELECT b.user_id FROM base b
  LEFT JOIN public.notification_preferences np ON np.user_id = b.user_id
  WHERE CASE public.push_pref_column(p_category)
    WHEN 'new_courses' THEN coalesce(np.new_courses, true)
    WHEN 'bundles_offers' THEN coalesce(np.bundles_offers, true)
    WHEN 'promotions' THEN coalesce(np.promotions, true)
    WHEN 'learning_updates' THEN coalesce(np.learning_updates, true)
    ELSE coalesce(np.announcements, true)
  END;
$$;

-- Atomically claim campaigns that are due (safe with several server instances)
CREATE OR REPLACE FUNCTION public.claim_due_push_notifications(p_limit integer DEFAULT 3)
RETURNS SETOF public.push_notifications LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.push_notifications
     SET status = 'sending', locked_at = now(), attempts = attempts + 1, updated_at = now()
   WHERE id IN (
     SELECT id FROM public.push_notifications
      WHERE status = 'scheduled' AND scheduled_at <= now()
      ORDER BY scheduled_at
      LIMIT greatest(1, least(p_limit, 10))
      FOR UPDATE SKIP LOCKED)
  RETURNING *;
$$;

-- Return interrupted sends (server crashed mid-send) to the queue. Devices already attempted
-- are skipped on resume thanks to push_tickets_once.
CREATE OR REPLACE FUNCTION public.requeue_stuck_push_notifications(p_minutes integer DEFAULT 10)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    UPDATE public.push_notifications
       SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'scheduled' END,
           last_error = CASE WHEN attempts >= 3 THEN 'Sending was interrupted 3 times.' ELSE 'Resumed after an interrupted send.' END,
           locked_at = NULL, updated_at = now()
     WHERE status = 'sending' AND locked_at < now() - make_interval(mins => p_minutes)
    RETURNING 1)
  SELECT count(*)::int FROM r;
$$;

REVOKE ALL ON FUNCTION public.push_audience(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_due_push_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.requeue_stuck_push_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_audience(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_push_notifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_stuck_push_notifications(integer) TO service_role;

-- ---------------------------------------------------------------- automatic announcements on publish
-- Fires only when a course/bundle becomes published (insert as published, or false → true).
-- push_announced makes it once-per-item forever: edits, re-saves and unpublish/republish never resend.
CREATE OR REPLACE FUNCTION public.queue_publish_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s jsonb;
  kind text := CASE TG_TABLE_NAME WHEN 'courses' THEN 'course' ELSE 'bundle' END;
  aud text;
  delay_min integer;
  thumb text;
BEGIN
  IF coalesce(NEW.is_published, false) IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.is_published, false) THEN RETURN NEW; END IF;
  IF kind = 'course' THEN
    IF coalesce(NEW.is_demo, false) THEN RETURN NEW; END IF; -- bundles have no is_demo column
  END IF;

  SELECT value INTO s FROM public.platform_settings WHERE key = 'push_notifications';
  IF coalesce((s ->> ('auto_' || kind || '_enabled'))::boolean, true) IS NOT TRUE THEN RETURN NEW; END IF;

  aud := coalesce(s ->> 'auto_audience', 'all_students');
  IF aud NOT IN ('all_students', 'enrolled_students') THEN aud := 'all_students'; END IF;
  delay_min := least(greatest(coalesce((s ->> 'auto_delay_minutes')::integer, 2), 0), 1440);
  -- Once per item, ever
  INSERT INTO public.push_announced (source_key) VALUES (kind || ':' || NEW.id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  thumb := CASE WHEN NEW.thumbnail_url ~ '^https://[^\s]+$' THEN NEW.thumbnail_url END;

  INSERT INTO public.push_notifications (
    title, body, image_url, action_url, category, course_id, bundle_id, audience,
    status, scheduled_at, source, source_key)
  VALUES (
    CASE kind WHEN 'course' THEN 'New Course Available!' ELSE 'New Course Bundle Available!' END,
    left(CASE kind
      WHEN 'course' THEN format('%s is now live on Edufy Academy. A new learning opportunity is waiting for you.', btrim(NEW.title))
      ELSE format('Unlock multiple courses with our latest bundle: %s.', btrim(NEW.title)) END, 240),
    thumb,
    CASE kind WHEN 'course' THEN '/course/' || NEW.id ELSE '/bundle/' || NEW.id END,
    CASE kind WHEN 'course' THEN 'new_course' ELSE 'new_bundle' END,
    CASE kind WHEN 'course' THEN NEW.id END,
    CASE kind WHEN 'bundle' THEN NEW.id END,
    aud,
    CASE WHEN coalesce((s ->> 'auto_requires_review')::boolean, false) THEN 'pending_review' ELSE 'scheduled' END,
    now() + make_interval(mins => delay_min),
    'auto_' || kind,
    kind || ':' || NEW.id)
  ON CONFLICT (source_key) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block publishing because of a notification problem
  RAISE WARNING 'queue_publish_notification failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_publish_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS courses_publish_notification ON public.courses;
CREATE TRIGGER courses_publish_notification AFTER INSERT OR UPDATE OF is_published ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.queue_publish_notification();
DROP TRIGGER IF EXISTS bundles_publish_notification ON public.bundles;
CREATE TRIGGER bundles_publish_notification AFTER INSERT OR UPDATE OF is_published ON public.bundles
  FOR EACH ROW EXECUTE FUNCTION public.queue_publish_notification();

-- ---------------------------------------------------------------- course completion → "certificate available"
-- Works for every completion path (video tracking on the server, manual completion of articles).
CREATE OR REPLACE FUNCTION public.notify_course_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total integer;
  done integer;
  c_title text;
  wants_push boolean;
BEGIN
  IF NOT coalesce(NEW.is_completed, false) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.is_completed, false) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = NEW.user_id AND course_id = NEW.course_id AND status IN ('active', 'completed')) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO total FROM public.lessons WHERE course_id = NEW.course_id;
  SELECT count(DISTINCT lp.lesson_id) INTO done
    FROM public.lesson_progress lp JOIN public.lessons l ON l.id = lp.lesson_id AND l.course_id = NEW.course_id
   WHERE lp.user_id = NEW.user_id AND lp.is_completed;
  IF total = 0 OR done < total THEN RETURN NEW; END IF;

  SELECT title INTO c_title FROM public.courses WHERE id = NEW.course_id;
  SELECT coalesce((SELECT learning_updates FROM public.notification_preferences WHERE user_id = NEW.user_id), true) INTO wants_push;

  INSERT INTO public.user_notifications (user_id, dedupe_key, title, body, action_url, category, course_id, push_status)
  VALUES (
    NEW.user_id, 'course_complete:' || NEW.course_id,
    'Course completed! 🎉',
    left(format('You finished %s. Your certificate is ready to claim.', coalesce(c_title, 'your course')), 240),
    '/certificates?claim=' || NEW.course_id, 'course_completion', NEW.course_id,
    CASE WHEN wants_push THEN 'pending' ELSE 'skipped' END)
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_course_completion failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_course_completion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lesson_progress_completion_notification ON public.lesson_progress;
CREATE TRIGGER lesson_progress_completion_notification AFTER INSERT OR UPDATE OF is_completed ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.notify_course_completion();

-- Certificate issued → record in the notification centre (the student claimed it, so no push)
CREATE OR REPLACE FUNCTION public.notify_certificate_issued()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, dedupe_key, title, body, action_url, category, course_id, push_status)
  VALUES (NEW.user_id, 'certificate:' || NEW.id, 'Certificate issued',
    left(format('Your certificate for %s is ready to view, download and share.', coalesce(NEW.course_title, 'your course')), 240),
    '/certificate/' || NEW.id, 'certificate', NEW.course_id, NULL)
  ON CONFLICT (user_id, dedupe_key) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_certificate_issued failed: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_certificate_issued() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS certificates_issued_notification ON public.certificates;
CREATE TRIGGER certificates_issued_notification AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.notify_certificate_issued();

-- Courses/bundles already published before this migration count as announced
INSERT INTO public.push_announced (source_key) SELECT 'course:' || id FROM public.courses WHERE is_published ON CONFLICT DO NOTHING;
INSERT INTO public.push_announced (source_key) SELECT 'bundle:' || id FROM public.bundles WHERE is_published ON CONFLICT DO NOTHING;

-- Live unread badge in the app (RLS applies to realtime)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;
