-- ============================================================================
-- Edufy Academy — Security hardening + demo support
-- Migration: 20261107000001_edufy_security_hardening.sql
--
-- Run AFTER 20261024000001_edufy_schema.sql. Safe to re-run (idempotent).
--
-- What this does:
--   1. Sign-up can never grant the admin role (the trigger ignores 'admin' metadata).
--   2. Users can't change their own role. Only the service role, the postgres
--      owner (SQL editor / server scripts) or an existing admin can.
--   3. Removes the over-permissive "Service role can manage payments" policy
--      (the service role bypasses RLS anyway; the policy opened payments to everyone).
--   4. Pins search_path on SECURITY DEFINER helper functions.
--   5. Adds is_demo flags and a course target_audience column.
--   6. Creates the storage buckets the app uses, with scoped policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New-user trigger: never trust client metadata for 'admin'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role public.user_role_type;
    v_full_name TEXT;
BEGIN
    -- Public sign-up may request 'instructor' (existing app feature) or default to 'student'.
    -- 'admin' is NEVER accepted from user metadata.
    IF LOWER(COALESCE(new.raw_user_meta_data->>'role', 'student')) = 'instructor' THEN
        v_role := 'instructor';
    ELSE
        v_role := 'student';
    END IF;

    v_full_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );

    INSERT INTO public.profiles (id, email, full_name, role, headline, bio)
    VALUES (
        new.id,
        new.email,
        v_full_name,
        v_role,
        CASE v_role WHEN 'instructor' THEN 'Instructor at Edufy Academy' ELSE 'Edufy Learner' END,
        ''
    )
    ON CONFLICT (id) DO NOTHING;   -- never overwrite an existing profile (or its role)

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Helper functions with pinned search_path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'instructor'); $$;

CREATE OR REPLACE FUNCTION public.is_enrolled(c_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = auth.uid() AND course_id = c_id AND status = 'active'); $$;

-- True when the statement runs with elevated (server-side) privileges.
CREATE OR REPLACE FUNCTION public.is_privileged_context()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT COALESCE(auth.role(), '') = 'service_role'
        OR current_user IN ('postgres', 'supabase_admin', 'service_role');
$$;

-- ---------------------------------------------------------------------------
-- 3. Role protection on profiles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_privileged_context() OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Client-side profile creation can only ever produce student/instructor.
        IF NEW.role = 'admin' THEN
            NEW.role := 'student';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Clients may edit their profile details but never their role.
        NEW.role := OLD.role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- 4. Payments: remove the policy that opened the table to every user
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;

-- ---------------------------------------------------------------------------
-- 5. Demo flags and extra course metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.courses  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.courses  ADD COLUMN IF NOT EXISTS target_audience JSONB NOT NULL DEFAULT '[]'::jsonb;

-- New courses should start as drafts, not live.
ALTER TABLE public.courses ALTER COLUMN is_published SET DEFAULT false;

-- ---------------------------------------------------------------------------
-- 6. Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
    ('course-thumbnails', 'course-thumbnails', true),   -- marketing images
    ('course-videos',     'course-videos',     true),   -- promotional / preview videos only
    ('course-materials',  'course-materials',  false),  -- paid lesson resources (signed URLs)
    ('avatars',           'avatars',           true),   -- profile images
    ('certificates',      'certificates',      true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Course videos public read" ON storage.objects;
CREATE POLICY "Course videos public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'course-videos');

DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Users may manage only files inside their own folder: avatars/<user-id>/...
DROP POLICY IF EXISTS "Users manage own avatar" ON storage.objects;
CREATE POLICY "Users manage own avatar"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Course thumbnails/videos/materials are written by the Express server with the
-- service role (POST /api/upload), so no client write policies are granted here.

-- ---------------------------------------------------------------------------
-- 7. Trigger functions must never be callable through the REST RPC endpoint
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;
