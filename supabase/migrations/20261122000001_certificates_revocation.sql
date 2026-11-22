-- Certificates: private records, public verification by code, revocation with an audit trail.
-- Safe to run more than once. Existing certificate rows are kept unchanged.

-- 1. Backup (the table is small; this is a point-in-time copy before the change)
create schema if not exists backup_20261122_cert;
create table if not exists backup_20261122_cert.certificates as table public.certificates;

-- 2. New optional columns on the existing table
alter table public.certificates
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revoke_reason text,
  add column if not exists course_hours numeric(6,1);

comment on column public.certificates.course_hours is 'Course length in hours at the time of issue (from courses.duration_hours); null when unknown.';

-- 3. Audit trail: issued / revoked / reinstated
create table if not exists public.certificate_audit (
  id bigint generated always as identity primary key,
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  action text not null check (action in ('issued', 'revoked', 'reinstated')),
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists certificate_audit_certificate_idx on public.certificate_audit (certificate_id, created_at desc);
alter table public.certificate_audit enable row level security;
drop policy if exists "Admins can read the certificate audit trail" on public.certificate_audit;
create policy "Admins can read the certificate audit trail" on public.certificate_audit
  for select using (public.is_admin());
-- No insert/update/delete policies: rows are written only by the functions below.

-- 4. Certificates are no longer listable by anyone: students see their own, admins see all.
--    Public verification goes through verify_certificate(), which returns only what a verifier needs.
drop policy if exists "Certificates are publicly verifiable by code" on public.certificates;
drop policy if exists "Students read own certificates, admins read all" on public.certificates;
create policy "Students read own certificates, admins read all" on public.certificates
  for select using (auth.uid() = user_id or public.is_admin());

-- 5. Public verification by certificate code (no user id, email or revocation reason)
create or replace function public.verify_certificate(p_code text)
returns table (
  certificate_code text,
  student_name text,
  course_title text,
  course_id text,
  instructor_name text,
  issue_date date,
  course_hours numeric,
  status text,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.certificate_code, c.student_name, c.course_title, c.course_id, c.instructor_name, c.issue_date,
         c.course_hours, case when c.revoked_at is null then 'valid' else 'revoked' end, c.revoked_at
  from public.certificates c
  where c.certificate_code = upper(btrim(p_code))
  limit 1;
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- 6. Admin: revoke or reinstate, always recorded in the audit trail
create or replace function public.set_certificate_revoked(p_certificate_id uuid, p_revoked boolean, p_reason text default null)
returns public.certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.certificates;
  why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a certificate''s status.' using errcode = '42501';
  end if;
  if p_revoked and why is null then
    raise exception 'Give a reason for revoking this certificate.' using errcode = '22023';
  end if;

  select * into r from public.certificates where id = p_certificate_id for update;
  if not found then
    raise exception 'Certificate not found.' using errcode = 'P0002';
  end if;

  if p_revoked and r.revoked_at is null then
    update public.certificates set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = why
      where id = r.id returning * into r;
    insert into public.certificate_audit (certificate_id, action, reason, actor_id) values (r.id, 'revoked', why, auth.uid());
  elsif not p_revoked and r.revoked_at is not null then
    update public.certificates set revoked_at = null, revoked_by = null, revoke_reason = null
      where id = r.id returning * into r;
    insert into public.certificate_audit (certificate_id, action, reason, actor_id) values (r.id, 'reinstated', why, auth.uid());
  end if;
  return r;
end;
$$;
revoke all on function public.set_certificate_revoked(uuid, boolean, text) from public;
grant execute on function public.set_certificate_revoked(uuid, boolean, text) to authenticated;

-- 7. Record every issue in the audit trail (never blocks the insert)
create or replace function public.audit_certificate_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.certificate_audit (certificate_id, action, actor_id) values (new.id, 'issued', new.user_id);
  return new;
exception when others then
  raise warning 'audit_certificate_issued failed: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists certificates_audit_issued on public.certificates;
create trigger certificates_audit_issued after insert on public.certificates
  for each row execute function public.audit_certificate_issued();
