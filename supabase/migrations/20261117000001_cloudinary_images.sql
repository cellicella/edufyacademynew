-- Cloudinary image CDN (additive only: new tables/columns, no existing data changed).
-- image_assets: every image stored in Cloudinary (secure_url + public_id), including the original URL of
-- migrated images (used for rollback). Only the API (service role) reads or writes these tables.

create table if not exists public.image_assets (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cloudinary',
  public_id text not null unique,
  secure_url text not null,
  format text,
  width integer,
  height integer,
  bytes integer,
  folder text,
  source text not null default 'upload' check (source in ('upload', 'media_library', 'avatar', 'migration')),
  original_url text,
  uploaded_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'deleted')),
  unused_since timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists image_assets_original_url_idx on public.image_assets (original_url);
create index if not exists image_assets_status_idx on public.image_assets (status, unused_since);
alter table public.image_assets enable row level security;
-- no policies: website/app clients cannot read or change it; the API uses the service role

create table if not exists public.image_migration_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'migrate' check (kind in ('dry_run', 'migrate', 'rollback')),
  started_by uuid references auth.users(id) on delete set null,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.image_migration_runs enable row level security;

-- Media library items can now live in Cloudinary (provider/public_id); existing rows stay "supabase"
alter table public.media_assets add column if not exists provider text not null default 'supabase';
alter table public.media_assets add column if not exists public_id text;
