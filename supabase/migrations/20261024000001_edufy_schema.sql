-- Edufy Academy - Supabase PostgreSQL Schema & Row Level Security (RLS) Policies
-- Migration: 20261024000001_edufy_schema.sql

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define Custom Types
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('student', 'instructor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lesson_type AS ENUM ('video', 'article', 'quiz');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('created', 'captured', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_status_type AS ENUM ('active', 'completed', 'refunded', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles table (synced with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    role user_role_type NOT NULL DEFAULT 'student',
    headline TEXT DEFAULT 'Edufy Learner',
    bio TEXT DEFAULT '',
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on email & role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. Courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY DEFAULT ('course-' || substr(md5(random()::text), 1, 8)),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    category_slug TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'All Levels', -- Beginner, Intermediate, Advanced, All Levels
    language TEXT NOT NULL DEFAULT 'English',
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    original_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    review_count INTEGER NOT NULL DEFAULT 0,
    enrolled_count INTEGER NOT NULL DEFAULT 0,
    duration_hours NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    total_lessons INTEGER NOT NULL DEFAULT 0,
    thumbnail_url TEXT NOT NULL,
    banner_url TEXT,
    featured BOOLEAN NOT NULL DEFAULT false,
    bestseller BOOLEAN NOT NULL DEFAULT false,
    trending BOOLEAN NOT NULL DEFAULT false,
    instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    learning_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_courses_category_slug ON public.courses(category_slug);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON public.courses(is_published);

-- 5. Course Sections
CREATE TABLE IF NOT EXISTS public.course_sections (
    id TEXT PRIMARY KEY DEFAULT ('sec-' || substr(md5(random()::text), 1, 8)),
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    section_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sections_course ON public.course_sections(course_id, section_order);

-- 6. Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
    id TEXT PRIMARY KEY DEFAULT ('les-' || substr(md5(random()::text), 1, 8)),
    section_id TEXT NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 10,
    type lesson_type NOT NULL DEFAULT 'video',
    video_url TEXT,
    content_text TEXT,
    storage_asset_path TEXT,
    is_free_preview BOOLEAN NOT NULL DEFAULT false,
    quiz_id TEXT,
    lesson_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON public.lessons(section_id, lesson_order);

-- 7. Payments table (Razorpay orders and verification)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    razorpay_order_id TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status payment_status_type NOT NULL DEFAULT 'created',
    receipt TEXT NOT NULL,
    notes JSONB DEFAULT '{}'::jsonb,
    webhook_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 8. Enrollments table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    status enrollment_status_type NOT NULL DEFAULT 'active',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);

-- 9. Lesson Progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    last_position_seconds INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user_course ON public.lesson_progress(user_id, course_id);

-- 10. Quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
    id TEXT PRIMARY KEY DEFAULT ('quiz-' || substr(md5(random()::text), 1, 8)),
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id TEXT REFERENCES public.lessons(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    passing_score_percentage INTEGER NOT NULL DEFAULT 80,
    time_limit_minutes INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes(course_id);

-- 11. Quiz Questions
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id TEXT PRIMARY KEY DEFAULT ('q-' || substr(md5(random()::text), 1, 8)),
    quiz_id TEXT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of string options
    correct_option_index INTEGER NOT NULL,
    explanation TEXT DEFAULT '',
    question_order INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, question_order);

-- 12. Quiz Attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_id TEXT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score_percentage INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON public.quiz_attempts(user_id, quiz_id);

-- 13. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_course ON public.reviews(course_id);

-- 14. Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id);

-- 15. Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_code TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    course_title TEXT NOT NULL,
    instructor_name TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    grade_percentage INTEGER NOT NULL DEFAULT 100,
    verification_hash TEXT NOT NULL,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON public.certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates(user_id);

--------------------------------------------------------------------------------
-- 16. Trigger to automatically create a Profile when auth.users signs up
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role public.user_role_type;
    v_full_name TEXT;
    v_avatar TEXT;
BEGIN
    -- Parse role from user metadata safely
    CASE LOWER(COALESCE(new.raw_user_meta_data->>'role', 'student'))
        WHEN 'instructor' THEN v_role := 'instructor'::public.user_role_type;
        WHEN 'admin' THEN v_role := 'admin'::public.user_role_type;
        ELSE v_role := 'student'::public.user_role_type;
    END CASE;

    -- Parse full name
    v_full_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );

    -- Default avatar URL
    v_avatar := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'avatar_url'), ''),
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'
    );

    BEGIN
        INSERT INTO public.profiles (
            id,
            email,
            full_name,
            avatar_url,
            role,
            headline,
            bio
        )
        VALUES (
            new.id,
            new.email,
            v_full_name,
            v_avatar,
            v_role,
            CASE v_role
                WHEN 'instructor' THEN 'Lead Instructor at Edufy Academy'
                WHEN 'admin' THEN 'Platform Administrator'
                ELSE 'Edufy Learner'
            END,
            ''
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
            avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url),
            role = CASE 
                WHEN public.profiles.role = 'admin' THEN public.profiles.role 
                ELSE EXCLUDED.role 
            END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'handle_new_user profile creation error for user %: %', new.id, SQLERRM;
    END;

    RETURN new;
END;
$$;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

--------------------------------------------------------------------------------
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'instructor'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_enrolled(c_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE user_id = auth.uid() AND course_id = c_id AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES Policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- COURSES Policies
CREATE POLICY "Published courses are viewable by everyone"
    ON public.courses FOR SELECT
    USING (is_published = true OR auth.uid() = instructor_id OR public.is_admin());

CREATE POLICY "Instructors can create courses"
    ON public.courses FOR INSERT
    WITH CHECK (auth.uid() = instructor_id AND (public.is_instructor() OR public.is_admin()));

CREATE POLICY "Instructors can update their own courses"
    ON public.courses FOR UPDATE
    USING (auth.uid() = instructor_id OR public.is_admin())
    WITH CHECK (auth.uid() = instructor_id OR public.is_admin());

CREATE POLICY "Admins can delete courses"
    ON public.courses FOR DELETE
    USING (public.is_admin());

-- COURSE SECTIONS Policies
CREATE POLICY "Sections viewable by anyone viewing the course"
    ON public.course_sections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_sections.course_id
            AND (c.is_published = true OR c.instructor_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Instructors and admins can manage sections"
    ON public.course_sections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_sections.course_id
            AND (c.instructor_id = auth.uid() OR public.is_admin())
        )
    );

-- LESSONS Policies
-- Free previews are viewable by everyone; enrolled students can view full lesson; instructors/admins can view their courses
CREATE POLICY "Lesson content access"
    ON public.lessons FOR SELECT
    USING (
        is_free_preview = true
        OR public.is_enrolled(lessons.course_id)
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = lessons.course_id
            AND (c.instructor_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Instructors and admins can manage lessons"
    ON public.lessons FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = lessons.course_id
            AND (c.instructor_id = auth.uid() OR public.is_admin())
        )
    );

-- PAYMENTS Policies
-- Users can view their own payments, admins can view all
CREATE POLICY "Users can view their own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Payments inserts/updates handled by backend service-role only, or restricted:
CREATE POLICY "Service role can manage payments"
    ON public.payments FOR ALL
    USING (true);

-- ENROLLMENTS Policies
CREATE POLICY "Students can view their own enrollments"
    ON public.enrollments FOR SELECT
    USING (
        auth.uid() = user_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = enrollments.course_id AND c.instructor_id = auth.uid()
        )
    );

-- LESSON PROGRESS Policies
CREATE POLICY "Users can manage their own lesson progress"
    ON public.lesson_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors and admins can view course progress"
    ON public.lesson_progress FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = lesson_progress.course_id AND c.instructor_id = auth.uid()
        )
    );

-- QUIZZES & QUESTIONS Policies
CREATE POLICY "Quizzes viewable by enrolled students or instructors"
    ON public.quizzes FOR SELECT
    USING (
        public.is_enrolled(quizzes.course_id)
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = quizzes.course_id AND c.instructor_id = auth.uid()
        )
    );

CREATE POLICY "Quiz questions viewable by enrolled students or instructors"
    ON public.quiz_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id
            AND (
                public.is_enrolled(q.course_id)
                OR public.is_admin()
                OR EXISTS (
                    SELECT 1 FROM public.courses c
                    WHERE c.id = q.course_id AND c.instructor_id = auth.uid()
                )
            )
        )
    );

-- QUIZ ATTEMPTS Policies
CREATE POLICY "Users can view and insert their own quiz attempts"
    ON public.quiz_attempts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors can view attempts for their quizzes"
    ON public.quiz_attempts FOR SELECT
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.quizzes q
            JOIN public.courses c ON q.course_id = c.id
            WHERE q.id = quiz_attempts.quiz_id AND c.instructor_id = auth.uid()
        )
    );

-- REVIEWS Policies
CREATE POLICY "Reviews viewable by anyone"
    ON public.reviews FOR SELECT
    USING (true);

CREATE POLICY "Enrolled students can create reviews"
    ON public.reviews FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.is_enrolled(reviews.course_id)
    );

CREATE POLICY "Users can update or delete their own reviews"
    ON public.reviews FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can delete any review"
    ON public.reviews FOR DELETE
    USING (public.is_admin());

-- WISHLISTS Policies
CREATE POLICY "Users can manage their own wishlist"
    ON public.wishlists FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- CERTIFICATES Policies
CREATE POLICY "Certificates are publicly verifiable by code"
    ON public.certificates FOR SELECT
    USING (true);

--------------------------------------------------------------------------------
-- 18. Storage Buckets configuration (metadata)
--------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('course-thumbnails', 'course-thumbnails', true),
    ('certificates', 'certificates', true),
    ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage policies:
CREATE POLICY "Course thumbnails public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'course-thumbnails');

CREATE POLICY "Certificates public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'certificates');

CREATE POLICY "Course materials enrolled students read"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'course-materials'
        AND (
            public.is_admin()
            OR EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.user_id = auth.uid()
                AND e.status = 'active'
                AND storage.objects.name LIKE (e.course_id || '/%')
            )
        )
    );
