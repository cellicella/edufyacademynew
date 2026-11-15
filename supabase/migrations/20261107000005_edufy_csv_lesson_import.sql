-- ============================================================================
-- Edufy Academy — CSV bulk lesson importer
-- Migration: 20261107000005_edufy_csv_lesson_import.sql (additive, idempotent)
-- No new tables: imported lessons use the existing lessons columns
-- (adilo_embed_url holds the validated Adilo player link, adilo_file_id stays NULL).
-- ============================================================================

-- Link-only Adilo lessons get the same protection as uploaded Adilo lessons:
-- learners cannot mark them complete or inflate watch time from the client;
-- the server marks them complete after verified player progress.
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
    IF EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.id = NEW.lesson_id
          AND (l.adilo_file_id IS NOT NULL OR l.adilo_embed_url IS NOT NULL)
    ) THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_completed := false;
            NEW.completed_at := NULL;
            NEW.watched_seconds := 0;
        ELSE
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

-- Speeds up duplicate checks (section + video link)
CREATE INDEX IF NOT EXISTS idx_lessons_section_embed ON public.lessons(section_id, adilo_embed_url);
