-- ============================================================================
-- Edufy Academy — Bundles, instructor applications, lesson resources,
-- platform settings and admin analytics RPCs.
-- Migration: 20261107000002_edufy_bundles_applications_admin.sql  (idempotent)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Platform settings (instructor revenue share = 70%)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_settings (key, value)
VALUES ('instructor_revenue_share', '0.70'::jsonb)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Settings readable by everyone" ON public.platform_settings;
CREATE POLICY "Settings readable by everyone" ON public.platform_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage settings" ON public.platform_settings;
CREATE POLICY "Admins manage settings" ON public.platform_settings FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.instructor_share()
RETURNS NUMERIC LANGUAGE sql STABLE SET search_path = public AS $$
    SELECT COALESCE((SELECT (value #>> '{}')::numeric FROM public.platform_settings WHERE key = 'instructor_revenue_share'), 0.70);
$$;

-- ---------------------------------------------------------------------------
-- 2. Course bundles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bundles (
    id TEXT PRIMARY KEY DEFAULT ('bundle-' || substr(md5(random()::text), 1, 8)),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bundle_courses (
    bundle_id TEXT NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (bundle_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_bundle_courses_course ON public.bundle_courses(course_id);

ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published bundles are public" ON public.bundles;
CREATE POLICY "Published bundles are public" ON public.bundles FOR SELECT
    USING (is_published = true OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage bundles" ON public.bundles;
CREATE POLICY "Admins manage bundles" ON public.bundles FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Bundle courses readable with bundle" ON public.bundle_courses;
CREATE POLICY "Bundle courses readable with bundle" ON public.bundle_courses FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.bundles b WHERE b.id = bundle_courses.bundle_id AND (b.is_published OR public.is_admin())));
DROP POLICY IF EXISTS "Admins manage bundle courses" ON public.bundle_courses;
CREATE POLICY "Admins manage bundle courses" ON public.bundle_courses FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.payments    ADD COLUMN IF NOT EXISTS bundle_id TEXT REFERENCES public.bundles(id) ON DELETE SET NULL;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS bundle_id TEXT REFERENCES public.bundles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Lesson resources (Udemy-style downloadable attachments)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Instructors manage quizzes/questions for their own courses
DROP POLICY IF EXISTS "Instructors manage own quizzes" ON public.quizzes;
CREATE POLICY "Instructors manage own quizzes" ON public.quizzes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = quizzes.course_id AND (c.instructor_id = auth.uid() OR public.is_admin())))
    WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = quizzes.course_id AND (c.instructor_id = auth.uid() OR public.is_admin())));
DROP POLICY IF EXISTS "Instructors manage own quiz questions" ON public.quiz_questions;
CREATE POLICY "Instructors manage own quiz questions" ON public.quiz_questions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
                   WHERE q.id = quiz_questions.quiz_id AND (c.instructor_id = auth.uid() OR public.is_admin())))
    WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q JOIN public.courses c ON c.id = q.course_id
                   WHERE q.id = quiz_questions.quiz_id AND (c.instructor_id = auth.uid() OR public.is_admin())));

-- ---------------------------------------------------------------------------
-- 4. Instructor applications (pending until an admin approves)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.instructor_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    headline TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    expertise TEXT NOT NULL DEFAULT '',
    website TEXT,
    status public.application_status NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_instructor_applications_status ON public.instructor_applications(status);
ALTER TABLE public.instructor_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Applicants read own application" ON public.instructor_applications;
CREATE POLICY "Applicants read own application" ON public.instructor_applications FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Applicants submit pending application" ON public.instructor_applications;
CREATE POLICY "Applicants submit pending application" ON public.instructor_applications FOR INSERT
    WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_by IS NULL);
DROP POLICY IF EXISTS "Applicants resubmit non-approved application" ON public.instructor_applications;
CREATE POLICY "Applicants resubmit non-approved application" ON public.instructor_applications FOR UPDATE
    USING (auth.uid() = user_id AND status <> 'approved')
    WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reviewed_by IS NULL);
DROP POLICY IF EXISTS "Admins manage applications" ON public.instructor_applications;
CREATE POLICY "Admins manage applications" ON public.instructor_applications FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sign-up: everyone starts as a student; "instructor" sign-ups become pending applications.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_full_name TEXT;
BEGIN
    v_full_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );

    INSERT INTO public.profiles (id, email, full_name, role, headline, bio)
    VALUES (new.id, new.email, v_full_name, 'student', 'Edufy Learner', '')
    ON CONFLICT (id) DO NOTHING;

    IF LOWER(COALESCE(new.raw_user_meta_data->>'role', '')) = 'instructor' THEN
        INSERT INTO public.instructor_applications (user_id, headline, bio)
        VALUES (new.id, 'Aspiring instructor', '')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Client-side profile inserts may never self-assign instructor or admin.
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
        NEW.role := 'student';
    ELSIF TG_OP = 'UPDATE' THEN
        NEW.role := OLD.role;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;

-- Admin: approve / reject an application
CREATE OR REPLACE FUNCTION public.review_instructor_application(p_application_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS public.instructor_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_app public.instructor_applications;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can review instructor applications' USING ERRCODE = '42501';
    END IF;

    UPDATE public.instructor_applications
       SET status = CASE WHEN p_approve THEN 'approved'::public.application_status ELSE 'rejected'::public.application_status END,
           admin_note = p_note,
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           updated_at = now()
     WHERE id = p_application_id
     RETURNING * INTO v_app;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    UPDATE public.profiles
       SET role = CASE WHEN p_approve THEN 'instructor'::public.user_role_type ELSE role END,
           headline = CASE WHEN p_approve AND COALESCE(v_app.headline, '') <> '' THEN v_app.headline ELSE headline END,
           bio = CASE WHEN p_approve AND COALESCE(v_app.bio, '') <> '' THEN v_app.bio ELSE bio END,
           updated_at = now()
     WHERE id = v_app.user_id AND role <> 'admin';

    RETURN v_app;
END;
$$;

-- Admin: switch a user between student and instructor (never to/from admin)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role public.user_role_type)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can change roles' USING ERRCODE = '42501';
    END IF;
    IF p_role = 'admin' THEN
        RAISE EXCEPTION 'Admin role can only be granted by the server setup script';
    END IF;
    UPDATE public.profiles SET role = p_role, updated_at = now()
     WHERE id = p_user_id AND role <> 'admin';
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Admin analytics (all SECURITY DEFINER, admin-only)
-- ---------------------------------------------------------------------------

-- Revenue attributed to each enrollment: payment amount split evenly across the
-- courses that payment unlocked (handles bundles and multi-course carts).
CREATE OR REPLACE VIEW public.enrollment_revenue
WITH (security_invoker = true) AS
SELECT e.id AS enrollment_id,
       e.user_id,
       e.course_id,
       e.bundle_id,
       e.enrolled_at,
       p.id AS payment_id,
       p.created_at AS paid_at,
       ROUND(p.amount / NULLIF(COUNT(*) OVER (PARTITION BY p.id), 0), 2) AS amount
FROM public.enrollments e
JOIN public.payments p ON p.id = e.payment_id AND p.status = 'captured';

CREATE OR REPLACE FUNCTION public.admin_revenue_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_share NUMERIC := public.instructor_share();
    v_result JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'instructor_share', v_share,
        'gross_revenue', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'captured'), 0),
        'refunded', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'refunded'), 0),
        'transactions', (SELECT COUNT(*) FROM payments WHERE status = 'captured'),
        'failed_transactions', (SELECT COUNT(*) FROM payments WHERE status = 'failed'),
        'paying_students', (SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'captured'),
        'bundle_revenue', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'captured' AND bundle_id IS NOT NULL), 0),
        'by_month', COALESCE((
            SELECT jsonb_agg(m ORDER BY m->>'month')
            FROM (
                SELECT jsonb_build_object('month', to_char(date_trunc('month', created_at), 'YYYY-MM'),
                                          'revenue', SUM(amount), 'transactions', COUNT(*)) AS m
                FROM payments
                WHERE status = 'captured' AND created_at > now() - interval '12 months'
                GROUP BY date_trunc('month', created_at)
            ) s), '[]'::jsonb),
        'by_course', COALESCE((
            SELECT jsonb_agg(c ORDER BY (c->>'revenue')::numeric DESC)
            FROM (
                SELECT jsonb_build_object('course_id', co.id, 'title', co.title,
                                          'instructor', pr.full_name,
                                          'sales', COUNT(er.enrollment_id),
                                          'revenue', COALESCE(SUM(er.amount), 0)) AS c
                FROM courses co
                LEFT JOIN profiles pr ON pr.id = co.instructor_id
                LEFT JOIN enrollment_revenue er ON er.course_id = co.id
                GROUP BY co.id, co.title, pr.full_name
            ) s), '[]'::jsonb),
        'recent', COALESCE((
            SELECT jsonb_agg(r)
            FROM (
                SELECT jsonb_build_object('id', p.id, 'order_id', p.razorpay_order_id, 'amount', p.amount,
                                          'status', p.status, 'created_at', p.created_at,
                                          'student', pr.full_name, 'email', pr.email,
                                          'item', COALESCE(b.title, co.title)) AS r
                FROM payments p
                LEFT JOIN profiles pr ON pr.id = p.user_id
                LEFT JOIN courses co ON co.id = p.course_id
                LEFT JOIN bundles b ON b.id = p.bundle_id
                ORDER BY p.created_at DESC
                LIMIT 25
            ) s), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_instructor_overview()
RETURNS TABLE (
    id UUID, full_name TEXT, email TEXT, avatar_url TEXT, headline TEXT, joined_at TIMESTAMPTZ,
    courses BIGINT, published_courses BIGINT, pending_courses BIGINT, students BIGINT,
    gross_revenue NUMERIC, instructor_earnings NUMERIC, avg_rating NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT p.id, p.full_name, p.email, p.avatar_url, p.headline, p.created_at,
           COUNT(DISTINCT c.id),
           COUNT(DISTINCT c.id) FILTER (WHERE c.is_published),
           COUNT(DISTINCT c.id) FILTER (WHERE c.prerequisites ? '__status:pending_review'),
           (SELECT COUNT(DISTINCT e.user_id) FROM enrollments e JOIN courses c2 ON c2.id = e.course_id WHERE c2.instructor_id = p.id),
           COALESCE((SELECT SUM(er.amount) FROM enrollment_revenue er JOIN courses c3 ON c3.id = er.course_id WHERE c3.instructor_id = p.id), 0),
           ROUND(COALESCE((SELECT SUM(er.amount) FROM enrollment_revenue er JOIN courses c3 ON c3.id = er.course_id WHERE c3.instructor_id = p.id), 0) * public.instructor_share(), 2),
           ROUND(AVG(NULLIF(c.rating, 0)) FILTER (WHERE c.review_count > 0), 2)
    FROM profiles p
    LEFT JOIN courses c ON c.instructor_id = p.id
    WHERE p.role = 'instructor'
    GROUP BY p.id
    ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_overview()
RETURNS TABLE (
    id UUID, full_name TEXT, email TEXT, avatar_url TEXT, joined_at TIMESTAMPTZ,
    enrollments BIGINT, completed_courses BIGINT, lessons_completed BIGINT,
    avg_progress NUMERIC, total_spent NUMERIC, last_active TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    WITH prog AS (
        SELECT e.user_id, e.course_id,
               LEAST(100, ROUND(100.0 * COUNT(lp.id) FILTER (WHERE lp.is_completed) / NULLIF(c.total_lessons, 0), 0)) AS pct
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN lesson_progress lp ON lp.user_id = e.user_id AND lp.course_id = e.course_id
        WHERE e.status = 'active'
        GROUP BY e.user_id, e.course_id, c.total_lessons
    )
    SELECT p.id, p.full_name, p.email, p.avatar_url, p.created_at,
           (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = p.id AND e.status = 'active'),
           (SELECT COUNT(*) FROM certificates ce WHERE ce.user_id = p.id),
           (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = p.id AND lp.is_completed),
           COALESCE((SELECT ROUND(AVG(pct), 0) FROM prog WHERE prog.user_id = p.id), 0),
           COALESCE((SELECT SUM(amount) FROM payments pa WHERE pa.user_id = p.id AND pa.status = 'captured'), 0),
           GREATEST(
               (SELECT MAX(lp.updated_at) FROM lesson_progress lp WHERE lp.user_id = p.id),
               (SELECT MAX(e.enrolled_at) FROM enrollments e WHERE e.user_id = p.id)
           )
    FROM profiles p
    WHERE p.role = 'student'
    ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_detail(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'profile', (SELECT jsonb_build_object('id', id, 'full_name', full_name, 'email', email, 'phone', phone,
                                              'avatar_url', avatar_url, 'headline', headline, 'joined_at', created_at)
                    FROM profiles WHERE id = p_user_id),
        'courses', COALESCE((
            SELECT jsonb_agg(x ORDER BY x->>'enrolled_at' DESC)
            FROM (
                SELECT jsonb_build_object(
                    'course_id', c.id,
                    'title', c.title,
                    'thumbnail_url', c.thumbnail_url,
                    'enrolled_at', e.enrolled_at,
                    'status', e.status,
                    'via_bundle', b.title,
                    'total_lessons', c.total_lessons,
                    'completed_lessons', (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = e.user_id AND lp.course_id = c.id AND lp.is_completed),
                    'last_activity', (SELECT MAX(lp.updated_at) FROM lesson_progress lp WHERE lp.user_id = e.user_id AND lp.course_id = c.id),
                    'best_quiz_score', (SELECT MAX(qa.score_percentage) FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE qa.user_id = e.user_id AND q.course_id = c.id),
                    'certificate_code', (SELECT ce.certificate_code FROM certificates ce WHERE ce.user_id = e.user_id AND ce.course_id = c.id)
                ) AS x
                FROM enrollments e
                JOIN courses c ON c.id = e.course_id
                LEFT JOIN bundles b ON b.id = e.bundle_id
                WHERE e.user_id = p_user_id
            ) s), '[]'::jsonb),
        'payments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('order_id', pa.razorpay_order_id, 'amount', pa.amount, 'status', pa.status,
                                                'created_at', pa.created_at, 'item', COALESCE(b.title, c.title))
                             ORDER BY pa.created_at DESC)
            FROM payments pa
            LEFT JOIN courses c ON c.id = pa.course_id
            LEFT JOIN bundles b ON b.id = pa.bundle_id
            WHERE pa.user_id = p_user_id), '[]'::jsonb)
    ) INTO v_result;
    RETURN v_result;
END;
$$;

-- Lock down RPC access: only signed-in users can call; the functions check is_admin() themselves.
REVOKE EXECUTE ON FUNCTION public.review_instructor_application(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(UUID, public.user_role_type) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_revenue_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_instructor_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_student_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_student_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_instructor_application(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, public.user_role_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_instructor_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_detail(UUID) TO authenticated;

-- The revenue view is only for the functions above.
REVOKE ALL ON public.enrollment_revenue FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Public curriculum outline (applied separately as edufy_public_course_outline)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_course_outline(p_course_ids TEXT[])
RETURNS TABLE (
    id TEXT, section_id TEXT, course_id TEXT, title TEXT,
    duration_minutes INTEGER, type public.lesson_type, is_free_preview BOOLEAN, lesson_order INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT l.id, l.section_id, l.course_id, l.title, l.duration_minutes, l.type, l.is_free_preview, l.lesson_order
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.course_id = ANY(p_course_ids)
      AND (c.is_published OR c.instructor_id = auth.uid() OR public.is_admin());
$$;
GRANT EXECUTE ON FUNCTION public.get_course_outline(TEXT[]) TO anon, authenticated;
