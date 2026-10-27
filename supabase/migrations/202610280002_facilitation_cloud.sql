-- v0.7.0: Optional private, owner-only facilitation workspace storage.
-- Apply AFTER the applications and admin dashboard migrations.
-- No workspace is populated; cloud sync remains OFF until operator approval.
create table if not exists public.facilitation_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint facilitation_workspace_shape check (
    jsonb_typeof(workspace) = 'object'
    and workspace @> '{"version":1,"sessions":{}}'::jsonb
    and octet_length(workspace::text) <= 400000
  )
);
alter table public.facilitation_workspaces enable row level security;
revoke all on public.facilitation_workspaces from public, anon, authenticated;
grant select, insert, update on public.facilitation_workspaces to service_role;

-- An optimistic concurrency write: accidental overwrites return conflict, not success.
-- The API authenticates the actual user against Supabase Auth BEFORE invoking this RPC.
create or replace function public.facilitation_save_workspace(
  p_actor uuid, p_expected_revision bigint, p_workspace jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_revision bigint;
begin
  if p_expected_revision is null or p_expected_revision < 0 or p_workspace is null then
    return jsonb_build_object('status','invalid');
  end if;
  if not exists (
    select 1 from public.admin_members where user_id = p_actor and active and role = 'owner'
  ) then return jsonb_build_object('status','forbidden'); end if;
  if jsonb_typeof(p_workspace) <> 'object' or not (p_workspace @> '{"version":1,"sessions":{}}'::jsonb)
     or octet_length(p_workspace::text) > 400000 then
    return jsonb_build_object('status','invalid');
  end if;

  -- Prevent races on the initial write by locking the corresponding Auth row.
  perform 1 from auth.users where id = p_actor for update;
  if not found then return jsonb_build_object('status','forbidden'); end if;
  select revision into current_revision from public.facilitation_workspaces
    where user_id = p_actor for update;
  if not found then
    if p_expected_revision <> 0 then return jsonb_build_object('status','conflict','revision',0); end if;
    insert into public.facilitation_workspaces(user_id,workspace,revision)
    values(p_actor,p_workspace,1);
    return jsonb_build_object('status','saved','revision',1);
  end if;
  if current_revision <> p_expected_revision then
    return jsonb_build_object('status','conflict','revision',current_revision);
  end if;
  update public.facilitation_workspaces
     set workspace = p_workspace, revision = revision + 1, updated_at = now()
   where user_id = p_actor;
  return jsonb_build_object('status','saved','revision',current_revision+1);
end; $$;
revoke execute on function public.facilitation_save_workspace(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.facilitation_save_workspace(uuid,bigint,jsonb) to service_role;
-- No student data or sensitive personal reflections should be saved here.
