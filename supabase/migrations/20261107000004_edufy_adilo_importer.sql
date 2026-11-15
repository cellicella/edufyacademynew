-- ============================================================================
-- Edufy Academy — Adilo bulk video importer
-- Migration: 20261107000004_edufy_adilo_importer.sql (additive, idempotent)
-- Reuses courses → course_sections → lessons (lessons.adilo_* columns from 000003).
-- ============================================================================

-- 1. Stable, duplicate-proof mapping: one lesson per Adilo file per course.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lessons_course_adilo_file
    ON public.lessons (course_id, adilo_file_id)
    WHERE adilo_file_id IS NOT NULL;

-- 2. Import history (server-only; admins read it through the Express API)
CREATE TABLE IF NOT EXISTS public.adilo_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    project_id TEXT NOT NULL,
    section_mode TEXT NOT NULL,             -- existing | new | folders
    status TEXT NOT NULL DEFAULT 'running', -- running | completed | partial | failed
    total INTEGER NOT NULL DEFAULT 0,
    imported INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_adilo_import_jobs_course ON public.adilo_import_jobs(course_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.adilo_import_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.adilo_import_jobs(id) ON DELETE CASCADE,
    adilo_file_id TEXT NOT NULL,
    lesson_id TEXT REFERENCES public.lessons(id) ON DELETE SET NULL,
    title TEXT,
    status TEXT NOT NULL,                   -- imported | updated | skipped | failed
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adilo_import_items_job ON public.adilo_import_items(job_id);

ALTER TABLE public.adilo_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adilo_import_items ENABLE ROW LEVEL SECURITY;
-- No client policies: only the Express server (service role, admin-checked) touches these tables.
