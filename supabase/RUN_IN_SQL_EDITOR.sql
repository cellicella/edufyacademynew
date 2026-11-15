-- ==============================================================================
-- Edufy Academy — database changes to apply ONCE (Supabase → SQL Editor → paste → Run).
-- Contains, in order:
--   1. Push notifications, notification centre, banners, offers (20261111000001)
--   2. Managed course categories + blog (20261112000001)
--   3. Settings & configuration: site settings, encrypted credentials, media library,
--      admin permissions, audit log, website/app banners (20261113000001)
--   4. Email outbox (queue + logs), automatic email triggers, Google / auth-hook credential
--      slots (20261114000001)
-- Safe to run more than once. Existing courses, bundles and enrollments are preserved.
-- ==============================================================================

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


-- ============================================================================
-- Edufy Academy — managed course categories + blog
-- Safe to re-run. Preserves every existing course ↔ category relationship
-- (courses.category / courses.category_slug stay; categories are seeded from them).
-- ============================================================================

-- ---------------------------------------------------------------- categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://[^\s]+$'),
  icon text CHECK (icon IS NULL OR icon ~ '^[A-Za-z0-9]{1,40}$'),
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_ci ON public.categories (lower(btrim(name)));

CREATE OR REPLACE FUNCTION public.slugify(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(trim(BOTH '-' FROM regexp_replace(lower(coalesce(v, '')), '[^a-z0-9]+', '-', 'g')), '');
$$;

-- Seed: the website's original six categories, then every category already used by a course
INSERT INTO public.categories (name, slug, description, icon, position) VALUES
  ('Web Development', 'web-development', 'React, TypeScript, Node.js, Next.js, GraphQL, and modern web architectures.', 'Code2', 1),
  ('Artificial Intelligence', 'ai-data-science', 'Machine Learning, PyTorch, LLMs, Computer Vision, and Neural Networks.', 'Cpu', 2),
  ('UI/UX Design', 'ui-ux-design', 'Figma, Design Systems, Usability, Micro-interactions, and Design Research.', 'Palette', 3),
  ('Cloud & DevOps', 'cloud-devops', 'AWS, Kubernetes, Terraform, Docker, CI/CD, and Site Reliability Engineering.', 'Cloud', 4),
  ('Business & Leadership', 'business-leadership', 'Product Management, Executive Strategy, Agile Operations, and Startup Scaling.', 'Briefcase', 5),
  ('Cybersecurity', 'cybersecurity', 'Penetration testing, cryptography, network defense, and DevSecOps.', 'ShieldCheck', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, position)
SELECT DISTINCT ON (s) c.category, s, 100
FROM (SELECT category, coalesce(nullif(category_slug, ''), public.slugify(category)) AS s FROM public.courses) c
WHERE c.s IS NOT NULL AND c.category IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.categories k WHERE k.slug = c.s)
  AND NOT EXISTS (SELECT 1 FROM public.categories k WHERE lower(btrim(k.name)) = lower(btrim(c.category)))
ORDER BY s
ON CONFLICT DO NOTHING;

-- Courses always point at a real category:
--  • the slug is resolved from the name when missing (or a name/slug mismatch is corrected)
--  • an unknown category is created (so instructor/admin saves never fail)
--  • courses.category always shows the category's current name
CREATE OR REPLACE FUNCTION public.courses_sync_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.categories;
BEGIN
  IF NEW.category IS NULL AND NEW.category_slug IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO k FROM public.categories WHERE slug = NEW.category_slug;
  IF NOT FOUND THEN
    SELECT * INTO k FROM public.categories WHERE lower(btrim(name)) = lower(btrim(NEW.category));
  END IF;
  IF NOT FOUND THEN
    INSERT INTO public.categories (name, slug, position)
    VALUES (btrim(coalesce(NEW.category, NEW.category_slug)), coalesce(nullif(NEW.category_slug, ''), public.slugify(NEW.category)), 100)
    ON CONFLICT (slug) DO UPDATE SET updated_at = now()
    RETURNING * INTO k;
  END IF;
  NEW.category_slug := k.slug;
  NEW.category := k.name;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.courses_sync_category() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS courses_sync_category ON public.courses;
CREATE TRIGGER courses_sync_category BEFORE INSERT OR UPDATE OF category, category_slug ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.courses_sync_category();

-- Bring existing rows in line (fires the trigger; only touches courses whose slug/name differ)
UPDATE public.courses c SET category_slug = k.slug
FROM public.categories k
WHERE NOT EXISTS (SELECT 1 FROM public.categories k2 WHERE k2.slug = c.category_slug)
  AND lower(btrim(k.name)) = lower(btrim(c.category));

-- Renaming a category renames it on its courses; deleting a category that still has courses is refused
DO $$ BEGIN
  ALTER TABLE public.courses ADD CONSTRAINT courses_category_fk FOREIGN KEY (category_slug)
    REFERENCES public.categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.categories_propagate_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- AFTER trigger: the new name is already stored, so courses_sync_category picks it up
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.courses SET category = NEW.name WHERE category_slug = NEW.slug;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.categories_propagate_name() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS categories_propagate_name ON public.categories;
CREATE TRIGGER categories_propagate_name AFTER UPDATE OF name ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.categories_propagate_name();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Active categories are public" ON public.categories;
CREATE POLICY "Active categories are public" ON public.categories FOR SELECT USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------- blog
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 120),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  excerpt text CHECK (excerpt IS NULL OR char_length(excerpt) <= 400),
  content_html text NOT NULL DEFAULT '' CHECK (char_length(content_html) <= 200000),
  cover_image_url text CHECK (cover_image_url IS NULL OR cover_image_url ~ '^https://[^\s]+$'),
  category text CHECK (category IS NULL OR char_length(category) <= 60),
  tags text[] NOT NULL DEFAULT '{}',
  author_name text CHECK (author_name IS NULL OR char_length(author_name) <= 80),
  author_role text CHECK (author_role IS NULL OR char_length(author_role) <= 80),
  author_avatar_url text CHECK (author_avatar_url IS NULL OR author_avatar_url ~ '^https://[^\s]+$'),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,          -- in the future = scheduled
  is_featured boolean NOT NULL DEFAULT false,
  seo_title text CHECK (seo_title IS NULL OR char_length(seo_title) <= 70),
  seo_description text CHECK (seo_description IS NULL OR char_length(seo_description) <= 170),
  reading_minutes integer NOT NULL DEFAULT 1 CHECK (reading_minutes BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_published_has_date CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS blog_posts_live_idx ON public.blog_posts (status, published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
-- Visitors and students see published posts once their publish time has passed (scheduling needs no job)
DROP POLICY IF EXISTS "Published posts are public" ON public.blog_posts;
CREATE POLICY "Published posts are public" ON public.blog_posts FOR SELECT USING (
  (status = 'published' AND published_at <= now()) OR public.is_admin()
);
DROP POLICY IF EXISTS "Admins manage posts" ON public.blog_posts;
CREATE POLICY "Admins manage posts" ON public.blog_posts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- Edufy Academy: centralized settings, encrypted credentials, media library,
-- admin permissions, audit log, and website/app banners.
--
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS).
--
-- Security model
--   * site_settings: written ONLY by the Express server (service role) after validation.
--     Public sections are exposed through get_public_settings() (no secrets are ever stored here).
--   * secure_credentials: AES-256-GCM ciphertext written by the server. No policies, so
--     anon/authenticated can never read it; only the service role can.
--   * settings_audit_log / admin_permissions / media_assets: admins can read; the server writes.
-- ============================================================================

-- ---------------------------------------------------------------- site_settings
CREATE TABLE IF NOT EXISTS public.site_settings (
  section text PRIMARY KEY CHECK (section ~ '^[a-z_]{2,40}$'),
  value jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(value) = 'object'),
  is_public boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_settings FROM anon, authenticated;
GRANT SELECT ON public.site_settings TO authenticated;
DROP POLICY IF EXISTS "Admins read settings" ON public.site_settings;
CREATE POLICY "Admins read settings" ON public.site_settings FOR SELECT USING (public.is_admin());

-- Public, non-sensitive settings for the website and the mobile app (fallback when the API is unreachable).
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'settings', COALESCE(jsonb_object_agg(s.section, s.value) FILTER (WHERE s.is_public), '{}'::jsonb),
    'updatedAt', max(s.updated_at),
    'version', COALESCE(sum(s.version) FILTER (WHERE s.is_public), 0)
  )
  FROM public.site_settings s;
$$;
REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------- secure_credentials
-- slot 'active' = used for real traffic; 'pending' = saved but not yet verified/activated.
CREATE TABLE IF NOT EXISTS public.secure_credentials (
  provider text NOT NULL CHECK (provider IN ('razorpay', 'email', 'emovur')),
  slot text NOT NULL DEFAULT 'active' CHECK (slot IN ('active', 'pending')),
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(public_config) = 'object'),
  secret_ciphertext text,
  secret_hint jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'failed')),
  verified_at timestamptz,
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (provider, slot)
);
ALTER TABLE public.secure_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.secure_credentials FROM anon, authenticated;
-- (intentionally no policies: only the service role can read or write)

-- ---------------------------------------------------------------- admin_permissions
-- No row for an admin = full access (keeps every existing admin working; nobody is locked out).
-- A row restricts the admin to `sections` unless is_super_admin. Instructors need a row to get any access.
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin boolean NOT NULL DEFAULT false,
  sections text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT admin_permissions_sections CHECK (sections <@ ARRAY[
    'general', 'branding', 'banners', 'media', 'contact', 'social', 'payment', 'whatsapp', 'email',
    'seo', 'app', 'notifications', 'maintenance', 'audit'
  ]::text[])
);
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_permissions FROM anon, authenticated;
GRANT SELECT ON public.admin_permissions TO authenticated;
DROP POLICY IF EXISTS "Admins read permissions" ON public.admin_permissions;
CREATE POLICY "Admins read permissions" ON public.admin_permissions FOR SELECT USING (public.is_admin() OR user_id = auth.uid());

-- ---------------------------------------------------------------- settings_audit_log
CREATE TABLE IF NOT EXISTS public.settings_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section text NOT NULL CHECK (char_length(section) <= 60),
  action text NOT NULL CHECK (char_length(action) <= 60),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  error text CHECK (error IS NULL OR char_length(error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settings_audit_log_created_idx ON public.settings_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS settings_audit_log_section_idx ON public.settings_audit_log (section, created_at DESC);
ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.settings_audit_log FROM anon, authenticated;
GRANT SELECT ON public.settings_audit_log TO authenticated;
DROP POLICY IF EXISTS "Admins read audit log" ON public.settings_audit_log;
CREATE POLICY "Admins read audit log" ON public.settings_audit_log FOR SELECT USING (public.is_admin());

-- ---------------------------------------------------------------- media_assets
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL DEFAULT 'site-assets',
  path text NOT NULL UNIQUE CHECK (char_length(path) BETWEEN 3 AND 300),
  url text NOT NULL CHECK (url ~ '^https://[^\s]+$'),
  asset_type text NOT NULL DEFAULT 'other' CHECK (asset_type IN (
    'website_banner', 'app_banner', 'course_thumbnail', 'bundle_image', 'blog_image',
    'category_image', 'promo', 'logo', 'seo', 'other'
  )),
  file_name text CHECK (file_name IS NULL OR char_length(file_name) <= 200),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  alt_text text CHECK (alt_text IS NULL OR char_length(alt_text) <= 200),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_assets_type_idx ON public.media_assets (asset_type, created_at DESC);
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_assets FROM anon, authenticated;
GRANT SELECT ON public.media_assets TO authenticated;
DROP POLICY IF EXISTS "Admins read media" ON public.media_assets;
CREATE POLICY "Admins read media" ON public.media_assets FOR SELECT USING (public.is_admin());

-- Public bucket for site images (logos, banners, promo). Uploads go through the server (service role).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-assets', 'site-assets', true, 8388608,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "Site assets public read" ON storage.objects;
CREATE POLICY "Site assets public read" ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');

-- ---------------------------------------------------------------- banners: website + app
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'app';
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS cta_text text;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS mobile_image_url text;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS blog_slug text;

ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_placement_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_placement_check CHECK (placement IN ('app', 'website', 'both'));
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_subtitle_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_subtitle_check CHECK (subtitle IS NULL OR char_length(subtitle) <= 160);
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_cta_text_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_cta_text_check CHECK (cta_text IS NULL OR char_length(btrim(cta_text)) BETWEEN 1 AND 40);
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_mobile_image_url_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_mobile_image_url_check CHECK (mobile_image_url IS NULL OR mobile_image_url ~ '^https://[^\s]+$');
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_blog_slug_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_blog_slug_check CHECK (blog_slug IS NULL OR blog_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_link_type_check;
ALTER TABLE public.banners ADD CONSTRAINT banners_link_type_check CHECK (link_type IN ('none', 'course', 'bundle', 'offer', 'blog', 'url'));
ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_link;
ALTER TABLE public.banners ADD CONSTRAINT banners_link CHECK (
  (link_type = 'course' AND course_id IS NOT NULL) OR (link_type = 'bundle' AND bundle_id IS NOT NULL) OR
  (link_type = 'offer' AND offer_id IS NOT NULL) OR (link_type = 'blog' AND blog_slug IS NOT NULL) OR
  (link_type = 'url' AND link_url IS NOT NULL) OR link_type = 'none'
);
CREATE INDEX IF NOT EXISTS banners_placement_idx ON public.banners (placement, is_active, position);

-- Audit trail for banner changes (made directly from the admin panel under RLS)
CREATE OR REPLACE FUNCTION public.audit_banner_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  act text;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; act := 'banner_delete';
  ELSIF TG_OP = 'INSERT' THEN rec := NEW; act := 'banner_create';
  ELSE rec := NEW; act := 'banner_update';
  END IF;
  INSERT INTO public.settings_audit_log (section, action, changes, actor_id, actor_email, status)
  VALUES (
    'banners', act,
    jsonb_build_object(
      'id', rec.id, 'title', rec.title, 'placement', rec.placement, 'is_active', rec.is_active,
      'from', CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('title', OLD.title, 'is_active', OLD.is_active, 'position', OLD.position, 'image_url', OLD.image_url) END,
      'to', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('title', NEW.title, 'is_active', NEW.is_active, 'position', NEW.position, 'image_url', NEW.image_url) END
    ),
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'success'
  );
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS banners_audit ON public.banners;
CREATE TRIGGER banners_audit AFTER INSERT OR UPDATE OR DELETE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.audit_banner_change();

-- ---------------------------------------------------------------- email log (send-once guard)
CREATE TABLE IF NOT EXISTS public.email_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  template text NOT NULL CHECK (char_length(template) <= 40),
  ref text NOT NULL DEFAULT '' CHECK (char_length(ref) <= 120),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error text CHECK (error IS NULL OR char_length(error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_log_once UNIQUE (user_id, template, ref)
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_log FROM anon, authenticated;

-- ---------------------------------------------------------------- default settings (current live values)
INSERT INTO public.site_settings (section, value, is_public) VALUES
  ('general', jsonb_build_object(
      'siteName', 'Edufy Academy', 'appName', 'Edufy Academy', 'siteUrl', '',
      'companyName', 'Educurist Learning Solutions Private Limited', 'companyAddress', '',
      'tagline', 'Excellence in Learning',
      'description', 'An online academy for technology and professional skills, with certificates anyone can verify.',
      'copyright', '© {year} Educurist Learning Solutions Private Limited. All rights reserved.',
      'defaultCountryCode', '+91'), true),
  ('contact', jsonb_build_object(
      'primaryPhone', '+91 99169 58480', 'secondaryPhone', '', 'supportEmail', '', 'salesEmail', '',
      'address', '', 'mapsUrl', '', 'businessHours', '',
      'pageTitle', 'Contact Edufy Academy',
      'pageIntro', 'Have questions about our courses, team licences or teaching on Edufy? Our student support team is here to help.'), true),
  ('social', jsonb_build_object('links', jsonb_build_array(
      jsonb_build_object('id', 'facebook',  'platform', 'facebook',  'label', 'Facebook',    'url', 'https://www.facebook.com/edufyacademy360/',          'enabled', true,  'position', 0),
      jsonb_build_object('id', 'instagram', 'platform', 'instagram', 'label', 'Instagram',   'url', 'https://www.instagram.com/edufyacademy_learning/',   'enabled', true,  'position', 1),
      jsonb_build_object('id', 'youtube',   'platform', 'youtube',   'label', 'YouTube',     'url', '',                                                  'enabled', false, 'position', 2),
      jsonb_build_object('id', 'linkedin',  'platform', 'linkedin',  'label', 'LinkedIn',    'url', 'https://www.linkedin.com/company/edufyacademy360/',  'enabled', true,  'position', 3),
      jsonb_build_object('id', 'x',         'platform', 'x',         'label', 'X (Twitter)', 'url', 'https://x.com/edufyacademy247',                      'enabled', true,  'position', 4),
      jsonb_build_object('id', 'reddit',    'platform', 'reddit',    'label', 'Reddit',      'url', 'https://www.reddit.com/user/edufyAcademy/',          'enabled', true,  'position', 5),
      jsonb_build_object('id', 'pinterest', 'platform', 'pinterest', 'label', 'Pinterest',   'url', 'https://in.pinterest.com/elseduacademy/',            'enabled', true,  'position', 6),
      jsonb_build_object('id', 'telegram',  'platform', 'telegram',  'label', 'Telegram',    'url', '',                                                  'enabled', false, 'position', 7),
      jsonb_build_object('id', 'whatsapp',  'platform', 'whatsapp',  'label', 'WhatsApp',    'url', 'https://wa.me/919916958480',                         'enabled', false, 'position', 8)
  )), true),
  ('whatsapp', jsonb_build_object(
      'enabled', true, 'number', '+91 99169 58480', 'buttonText', 'Chat with us on WhatsApp',
      'welcomeMessage', 'Hi Edufy Academy, I have a question about your courses.',
      'supportMessage', 'Hi Edufy Academy, I need help with my account.'), true)
ON CONFLICT (section) DO NOTHING;

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
