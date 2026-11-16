-- Men in HR Connect v0.8.0: private attendance, media, AI notes and member certificates.
-- REVIEW ONLY: do not apply to staging or production until the go-live checklist is approved.
-- All participant/media operations remain behind server-side feature gates.

create extension if not exists pgcrypto;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  session_number smallint not null check (session_number between 1 and 20),
  title text not null check (char_length(btrim(title)) between 4 and 160),
  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 60 check (duration_minutes between 15 and 240),
  meeting_url text,
  status text not null default 'planned' check (status in ('planned','completed','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_meet_url_https check (
    meeting_url is null or (meeting_url ~ '^https://meet[.]google[.]com/' and char_length(meeting_url) <= 500)
  ),
  constraint attendance_session_number_per_cohort unique (cohort_id, session_number)
);

create index if not exists idx_attendance_sessions_cohort_scheduled
  on public.attendance_sessions (cohort_id, scheduled_at desc);

create table if not exists public.attendance_participants (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  normalized_name text not null check (char_length(normalized_name) between 2 and 120),
  email text check (email is null or char_length(email) between 5 and 254),
  normalized_email text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((email is null and normalized_email is null) or (email is not null and normalized_email is not null))
);
create index if not exists idx_attendance_participants_cohort_name
  on public.attendance_participants (cohort_id, normalized_name);
create unique index if not exists uniq_attendance_participant_cohort_email
  on public.attendance_participants (cohort_id, normalized_email) where normalized_email is not null;

create table if not exists public.attendance_imports (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  session_id uuid references public.attendance_sessions(id) on delete restrict,
  import_type text not null check (import_type in ('roster','report')),
  status text not null default 'preview' check (status in ('preview','confirmed','rejected')),
  source_file_name text not null check (char_length(source_file_name) between 1 and 160),
  row_count integer not null default 0 check (row_count between 0 and 1000),
  summary jsonb not null default '{}'::jsonb,
  imported_by uuid not null references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check ((import_type = 'roster' and session_id is null) or (import_type = 'report' and session_id is not null))
);

create table if not exists public.attendance_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.attendance_imports(id) on delete cascade,
  row_number integer not null check (row_number between 1 and 1001),
  raw_name text not null check (char_length(raw_name) between 1 and 160),
  normalized_name text not null check (char_length(normalized_name) between 1 and 160),
  raw_duration text,
  attended_seconds integer check (attended_seconds is null or attended_seconds between 0 and 86400),
  joined_at_text text,
  participant_id uuid references public.attendance_participants(id) on delete restrict,
  match_status text not null check (match_status in ('suggested','ambiguous','unmatched','confirmed','invalid')),
  duplicate_name boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  unique (import_id, row_number)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete restrict,
  participant_id uuid not null references public.attendance_participants(id) on delete restrict,
  import_id uuid not null references public.attendance_imports(id) on delete restrict,
  attended_seconds integer not null check (attended_seconds between 0 and 86400),
  attendance_percent numeric(5,2) not null check (attendance_percent between 0 and 100),
  first_join_text text,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create table if not exists public.attendance_changes (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.attendance_imports(id) on delete restrict,
  import_row_id uuid references public.attendance_import_rows(id) on delete restrict,
  participant_id uuid references public.attendance_participants(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('roster_imported','report_confirmed','match_changed','row_left_unmatched','attendance_updated')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.participant_member_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_id uuid not null unique references public.attendance_participants(id) on delete restrict,
  active boolean not null default true,
  linked_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.session_resources (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  session_id uuid references public.attendance_sessions(id) on delete restrict,
  participant_id uuid references public.attendance_participants(id) on delete restrict,
  source_resource_id uuid references public.session_resources(id) on delete restrict,
  kind text not null check (kind in ('recording','transcript','summary','action_items','certificate')),
  status text not null default 'uploading' check (status in ('uploading','ready','processing','pending_review','approved','failed')),
  object_path text unique,
  file_name text,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 524288000),
  content_text text,
  content_json jsonb,
  error_code text check (error_code is null or char_length(error_code) <= 80),
  recording_notice_attested boolean not null default false,
  consent_attested_by uuid references auth.users(id) on delete restrict,
  consent_attested_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind in ('recording','certificate') and object_path is not null and file_name is not null and content_type is not null and size_bytes is not null)
    or (kind in ('transcript','summary','action_items') and content_text is not null)
  ),
  check (
    (kind = 'certificate' and participant_id is not null)
    or (kind <> 'certificate' and participant_id is null)
  ),
  check (
    kind <> 'recording' or (
      session_id is not null and recording_notice_attested = true
      and consent_attested_by is not null and consent_attested_at is not null
    )
  )
);
create index if not exists idx_session_resources_session on public.session_resources (session_id, created_at desc);
create index if not exists idx_session_resources_participant on public.session_resources (participant_id, created_at desc);
create unique index if not exists uniq_session_note_source_kind
  on public.session_resources (source_resource_id, kind)
  where source_resource_id is not null and kind in ('transcript','summary','action_items');

create table if not exists public.session_resource_shares (
  resource_id uuid not null references public.session_resources(id) on delete cascade,
  participant_id uuid not null references public.attendance_participants(id) on delete restrict,
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  primary key (resource_id, participant_id),
  check ((revoked_by is null and revoked_at is null) or (revoked_by is not null and revoked_at is not null))
);

create table if not exists public.session_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  source_resource_id uuid not null references public.session_resources(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_session_ai_jobs_resource_created
  on public.session_ai_jobs (source_resource_id, created_at desc);
create unique index if not exists uniq_active_session_ai_job
  on public.session_ai_jobs (source_resource_id)
  where status in ('queued','processing');

create table if not exists public.session_resource_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references public.session_resources(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  participant_id uuid references public.attendance_participants(id) on delete set null,
  action text not null check (action in ('uploaded','processed','approved','shared','unshared','download_authorized','deleted','certificate_assigned','member_invited')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_session_resource_events_created on public.session_resource_events (created_at desc);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_participants enable row level security;
alter table public.attendance_imports enable row level security;
alter table public.attendance_import_rows enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_changes enable row level security;
alter table public.participant_member_accounts enable row level security;
alter table public.session_resources enable row level security;
alter table public.session_resource_shares enable row level security;
alter table public.session_ai_jobs enable row level security;
alter table public.session_resource_events enable row level security;

revoke all on public.attendance_sessions, public.attendance_participants, public.attendance_imports,
  public.attendance_import_rows, public.attendance_records, public.attendance_changes,
  public.participant_member_accounts, public.session_resources, public.session_resource_shares,
  public.session_ai_jobs, public.session_resource_events from public, anon, authenticated;
grant select, insert, update, delete on public.attendance_sessions, public.attendance_participants,
  public.attendance_imports, public.attendance_import_rows, public.attendance_records,
  public.attendance_changes, public.participant_member_accounts, public.session_resources,
  public.session_resource_shares, public.session_ai_jobs, public.session_resource_events to service_role;

create or replace function public.admin_complete_session_ai_job(
  p_actor uuid, p_job_id uuid, p_transcript text, p_summary text, p_action_items text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.session_ai_jobs%rowtype; source public.session_resources%rowtype;
begin
  if not exists (
    select 1 from public.admin_members
    where user_id = p_actor and active = true and role in ('owner','coordinator')
  ) then return false; end if;
  if char_length(p_transcript) not between 1 and 200000
    or char_length(p_summary) not between 1 and 20000
    or char_length(p_action_items) not between 2 and 20000 then return false; end if;
  select * into job from public.session_ai_jobs where id = p_job_id for update;
  if not found or job.status <> 'processing' then return false; end if;
  select * into source from public.session_resources where id = job.source_resource_id for update;
  if not found or source.kind <> 'recording' or source.status <> 'ready'
    or source.recording_notice_attested <> true or source.consent_attested_by is null then return false; end if;

  insert into public.session_resources (cohort_id, session_id, source_resource_id, kind, status, content_text, created_by)
  values (source.cohort_id, source.session_id, source.id, 'transcript', 'pending_review', p_transcript, p_actor);
  insert into public.session_resources (cohort_id, session_id, source_resource_id, kind, status, content_text, created_by)
  values (source.cohort_id, source.session_id, source.id, 'summary', 'pending_review', p_summary, p_actor);
  insert into public.session_resources (cohort_id, session_id, source_resource_id, kind, status, content_text, created_by)
  values (source.cohort_id, source.session_id, source.id, 'action_items', 'pending_review', p_action_items, p_actor);
  update public.session_ai_jobs set status = 'completed', error_code = null, completed_at = now() where id = p_job_id;
  insert into public.session_resource_events (resource_id, actor_id, action, details)
  values (source.id, p_actor, 'processed', jsonb_build_object('job_id', p_job_id));
  return true;
end; $$;

revoke execute on function public.admin_complete_session_ai_job(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_complete_session_ai_job(uuid,uuid,text,text,text) to service_role;

-- The storage bucket holds private meeting recordings and member certificates.
-- Existing buckets are never made public or silently reconfigured by this migration.
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'menhr-private') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'menhr-private', 'menhr-private', false, 524288000,
      array['video/mp4','video/webm','audio/mp4','audio/mpeg','audio/wav','audio/webm','application/pdf']::text[]
    );
  elsif exists (select 1 from storage.buckets where id = 'menhr-private' and public = true) then
    raise exception 'menhr-private already exists as a public bucket; review it manually before migration';
  end if;
end $$;

-- One server-authorized, stable page across shares and assigned certificates.
-- This is service-role-only; the Netlify handler independently verifies the member JWT and active assignment.
create or replace function public.member_list_session_resources(
  p_actor uuid,
  p_participant_id uuid,
  p_offset integer,
  p_limit integer
) returns table (
  id uuid,
  session_id uuid,
  participant_id uuid,
  kind text,
  status text,
  file_name text,
  content_type text,
  size_bytes bigint,
  content_text text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor is null or p_participant_id is null
    or p_offset is null or p_offset < 0 or p_offset >= 5000
    or p_limit is null or p_limit < 1 or p_limit > 201 then
    return;
  end if;
  if not exists (
    select 1
    from public.participant_member_accounts ma
    join public.attendance_participants ap on ap.id = ma.participant_id
    where ma.user_id = p_actor and ma.participant_id = p_participant_id
      and ma.active = true and ap.active = true
  ) then
    return;
  end if;
  return query
    with eligible as (
      select r.id,r.session_id,r.participant_id,r.kind,r.status,r.file_name,r.content_type,
        r.size_bytes,r.content_text,r.created_at
      from public.session_resources r
      where r.participant_id = p_participant_id and r.kind = 'certificate'
        and r.status in ('ready','approved')
      union all
      select r.id,r.session_id,r.participant_id,r.kind,r.status,r.file_name,r.content_type,
        r.size_bytes,r.content_text,r.created_at
      from public.session_resources r
      join public.session_resource_shares sh on sh.resource_id = r.id
      where sh.participant_id = p_participant_id and sh.revoked_at is null
        and r.participant_id is null and r.kind <> 'certificate'
        and r.status in ('ready','approved')
    )
    select e.id,e.session_id,e.participant_id,e.kind,e.status,e.file_name,e.content_type,
      e.size_bytes,e.content_text,e.created_at
    from eligible e
    order by e.created_at desc,e.id desc
    offset p_offset limit p_limit;
end; $$;

revoke all on function public.member_list_session_resources(uuid,uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.member_list_session_resources(uuid,uuid,integer,integer) to service_role;
