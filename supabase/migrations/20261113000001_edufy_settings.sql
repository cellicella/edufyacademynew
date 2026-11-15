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
