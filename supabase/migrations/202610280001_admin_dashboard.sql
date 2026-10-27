-- Run AFTER 202610270001_applications.sql. Administration is DENY-BY-DEFAULT.
-- Never insert public users or hard-code email addresses in this migration.

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'coordinator')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.application_decisions (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid not null,
  previous_status text not null,
  new_status text not null,
  decided_at timestamptz not null default now()
);

create table if not exists public.cohort_changes (
  id bigint generated always as identity primary key,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  actor_id uuid not null,
  action text not null check (action in ('created', 'opened', 'closed')),
  changed_at timestamptz not null default now()
);

alter table public.admin_members enable row level security;
alter table public.application_decisions enable row level security;
alter table public.cohort_changes enable row level security;
revoke all on public.admin_members, public.application_decisions, public.cohort_changes from public, anon, authenticated;
grant select on public.admin_members to service_role;
grant select, insert on public.application_decisions, public.cohort_changes to service_role;

-- Each decision and its audit log are committed in ONE database transaction.
create or replace function public.admin_set_application_status(
  p_actor uuid, p_application_id uuid, p_new_status text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare old_status text;
begin
  if not exists (select 1 from public.admin_members where user_id = p_actor and active = true and role in ('owner','coordinator')) then return false; end if;
  if p_new_status not in ('pending','approved','declined') then return false; end if;
  select status into old_status from public.applications where id = p_application_id for update;
  if not found or old_status = 'withdrawn' or old_status = p_new_status then return false; end if;
  update public.applications set status = p_new_status where id = p_application_id;
  insert into public.application_decisions (application_id,actor_id,previous_status,new_status)
  values(p_application_id,p_actor,old_status,p_new_status);
  return true;
end; $$;

create or replace function public.admin_create_cohort(
  p_actor uuid, p_slug text, p_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.admin_members where user_id = p_actor and active and role = 'owner') then return null; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) > 60 or length(btrim(p_name)) not between 4 and 120 then return null; end if;
  insert into public.cohorts (slug,name,applications_open) values (p_slug,btrim(p_name),false) returning id into new_id;
  insert into public.cohort_changes (cohort_id,actor_id,action) values (new_id,p_actor,'created');
  return new_id;
end; $$;

create or replace function public.admin_set_cohort_open(
  p_actor uuid, p_cohort_id uuid, p_open boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare was_open boolean;
begin
  if not exists (select 1 from public.admin_members where user_id = p_actor and active and role = 'owner') then return false; end if;
  select applications_open into was_open from public.cohorts where id = p_cohort_id for update;
  if not found or was_open = p_open then return false; end if;
  update public.cohorts set applications_open = p_open where id = p_cohort_id;
  insert into public.cohort_changes (cohort_id,actor_id,action)
  values (p_cohort_id,p_actor,case when p_open then 'opened' else 'closed' end);
  return true;
end; $$;

revoke execute on function public.admin_set_application_status(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_create_cohort(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.admin_set_cohort_open(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_application_status(uuid,uuid,text) to service_role;
grant execute on function public.admin_create_cohort(uuid,text,text) to service_role;
grant execute on function public.admin_set_cohort_open(uuid,uuid,boolean) to service_role;

-- REQUIRED MANUAL BOOTSTRAP (replace the UUID with an existing, verified auth.users.id):
-- insert into public.admin_members (user_id,role,active)
-- values ('00000000-0000-0000-0000-000000000000','owner',true)
-- on conflict (user_id) do update set role=excluded.role, active=excluded.active;
-- Only the authorised institution's administrator should perform this action.
