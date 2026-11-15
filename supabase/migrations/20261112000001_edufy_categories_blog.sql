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
