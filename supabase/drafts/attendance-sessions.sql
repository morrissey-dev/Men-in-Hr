-- DRAFT ONLY: Men in HR attendance session foundation.
-- This file is a schema proposal, not an applied migration.
-- Create a tracked migration with the Supabase CLI after reviewing and approving it.

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  session_number smallint not null check (session_number between 1 and 20),
  title text not null check (char_length(btrim(title)) between 4 and 160),
  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 60 check (duration_minutes between 15 and 240),
  meeting_url text,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_meet_url_https check (
    meeting_url is null
    or (
      meeting_url ~ '^https://meet[.]google[.]com/'
      and char_length(meeting_url) <= 500
    )
  ),
  constraint attendance_session_number_per_cohort unique (cohort_id, session_number)
);

create index if not exists idx_attendance_sessions_cohort_scheduled
  on public.attendance_sessions (cohort_id, scheduled_at desc);

alter table public.attendance_sessions enable row level security;

-- Attendance is accessed only through authenticated Netlify admin functions.
-- The server validates the Supabase user and active admin_members role before
-- using the server-only Supabase secret. No direct browser table access is granted.
revoke all on public.attendance_sessions from anon, authenticated, public;
grant select, insert, update, delete on public.attendance_sessions to service_role;
