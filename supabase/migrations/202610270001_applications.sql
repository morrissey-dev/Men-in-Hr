-- Men in HR Connect — closed-by-default application database.
-- Run in a dedicated Supabase project via SQL editor after institutional approval.
create extension if not exists pgcrypto;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  applications_open boolean not null default false,
  created_at timestamptz not null default now(),
  constraint cohort_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  full_name text not null check (char_length(full_name) between 3 and 100),
  email text not null check (char_length(email) between 5 and 254),
  institution text not null check (char_length(institution) between 2 and 120),
  year_of_study text not null check (year_of_study in ('1','2','3','4','5','6+','postgraduate','other')),
  interests text[] not null check (cardinality(interests) between 1 and 3),
  motivation text not null default '' check (char_length(motivation) <= 400),
  confirmed_adult boolean not null check (confirmed_adult = true),
  privacy_notice_version text not null,
  privacy_consented_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  created_at timestamptz not null default now()
);

-- Prevent duplicate applications for the same cohort, ignoring case.
create unique index if not exists uniq_cohort_lower_email on public.applications (cohort_id, lower(email));
create index if not exists idx_application_cohort_created on public.applications (cohort_id, created_at desc);

alter table public.cohorts enable row level security;
alter table public.applications enable row level security;
-- Explicitly revoke inherited public-schema privileges. No anonymous policies exist.
revoke all on public.cohorts from anon, authenticated, public;
revoke all on public.applications from anon, authenticated, public;
grant select on public.cohorts to service_role;
grant select, insert, update, delete on public.applications to service_role;

insert into public.cohorts (slug, name, applications_open)
values ('cohort-1', 'Men in HR — Cohort 1', false)
on conflict (slug) do nothing;

-- Privacy/retention: arrange scheduled deletion or execute approved manual deletion.
-- Example after confirming retention policy and completing any lawful hold:
-- delete from public.applications where created_at < now() - interval '180 days';

-- Launch needs BOTH APPLICATIONS_OPEN=true on server and an explicitly open cohort:
-- update public.cohorts set applications_open = true where slug = 'cohort-1';
