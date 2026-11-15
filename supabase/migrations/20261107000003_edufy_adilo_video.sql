-- ============================================================================
-- Edufy Academy — Adilo video hosting integration
-- Migration: 20261107000003_edufy_adilo_video.sql (additive, idempotent)
-- ============================================================================

-- 1. Adilo video fields on the existing lessons table (no new lesson table)
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS adilo_file_id     TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS adilo_project_id  TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS adilo_embed_url   TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_title       TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_duration    INTEGER;      -- seconds
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_status      TEXT;         -- uploading | uploaded | error
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_created_at  TIMESTAMPTZ;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_updated_at  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_lessons_adilo_file ON public.lessons(adilo_file_id);
-- Lesson rows (including these columns) are already protected by the existing
-- "Lesson content access" RLS policy: free previews, enrolled learners, the course
-- instructor and admins only. get_course_outline() does not expose these columns.

-- 2. Server-side record of every upload started through Edufy.
--    Used to verify that a file being attached to a lesson was uploaded by that user.
CREATE TABLE IF NOT EXISTS public.adilo_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES public.courses(id) ON DELETE SET NULL,
    upload_id TEXT NOT NULL UNIQUE,
    upload_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    filesize BIGINT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploading',   -- uploading | uploaded | failed | deleted
    adilo_file_id TEXT,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adilo_uploads_file ON public.adilo_uploads(adilo_file_id);
ALTER TABLE public.adilo_uploads ENABLE ROW LEVEL SECURITY;
-- No client policies: only the Express server (service role) reads/writes this table.

-- 3. Verified video watch progress
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS watched_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;

-- Clients may not mark an Adilo video lesson complete or inflate watch time themselves;
-- the server (service role) does this after validating player progress.
CREATE OR REPLACE FUNCTION public.protect_video_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_privileged_context() THEN
        RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = NEW.lesson_id AND l.adilo_file_id IS NOT NULL) THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_completed := false;
            NEW.completed_at := NULL;
            NEW.watched_seconds := 0;
        ELSE
            -- allow un-marking, never self-marking as complete
            IF NEW.is_completed AND NOT OLD.is_completed THEN
                NEW.is_completed := OLD.is_completed;
                NEW.completed_at := OLD.completed_at;
            END IF;
            NEW.watched_seconds := OLD.watched_seconds;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_video_progress() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_video_progress ON public.lesson_progress;
CREATE TRIGGER protect_video_progress
    BEFORE INSERT OR UPDATE ON public.lesson_progress
    FOR EACH ROW EXECUTE FUNCTION public.protect_video_progress();

-- 4. FIX: inside SECURITY DEFINER triggers current_user is the function owner, so the old
--    check treated every request as privileged (role and progress protection were bypassed).
CREATE OR REPLACE FUNCTION public.is_privileged_context()
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public AS $$
    SELECT COALESCE(auth.role(), '') = 'service_role'
        OR (NULLIF(current_setting('request.jwt.claims', true), '') IS NULL
            AND session_user IN ('postgres', 'supabase_admin'));
$$;
