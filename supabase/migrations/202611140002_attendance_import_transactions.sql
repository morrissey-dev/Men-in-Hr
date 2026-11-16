-- Additive, review-only transaction boundary for attendance CSV imports.
-- Apply only after schema review. All import writes occur atomically through these RPCs.
create or replace function public.admin_commit_attendance_roster_import(
  p_actor uuid, p_cohort_id uuid, p_file_name text, p_rows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_import uuid; v_item jsonb; v_n integer := 0; v_email text;
begin
  if not exists (select 1 from public.admin_members where user_id=p_actor and active=true and role in ('owner','coordinator')) then return '{"ok":false}'::jsonb; end if;
  if p_file_name is null or char_length(btrim(p_file_name)) not between 1 and 160 or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 1000 then return '{"ok":false}'::jsonb; end if;
  if not exists(select 1 from public.cohorts where id=p_cohort_id) then return '{"ok":false}'::jsonb; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where char_length(coalesce(x->>'name','')) not between 2 and 120 or char_length(coalesce(x->>'normalized_name','')) not between 2 and 120 or (nullif(x->>'email','') is not null and char_length(x->>'email') not between 5 and 254)) then return '{"ok":false}'::jsonb; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where nullif(x->>'normalized_email','') is not null group by x->>'normalized_email' having count(*)>1) then return '{"ok":false}'::jsonb; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x join public.attendance_participants p on p.cohort_id=p_cohort_id and p.normalized_email=x->>'normalized_email' where nullif(x->>'normalized_email','') is not null) then return '{"ok":false}'::jsonb; end if;
  insert into public.attendance_imports(cohort_id,import_type,status,source_file_name,row_count,summary,imported_by,confirmed_by,confirmed_at)
  values(p_cohort_id,'roster','confirmed',btrim(p_file_name),jsonb_array_length(p_rows),jsonb_build_object('new',jsonb_array_length(p_rows)),p_actor,p_actor,now()) returning id into v_import;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    insert into public.attendance_participants(cohort_id,full_name,normalized_name,email,normalized_email,created_by)
    values(p_cohort_id,v_item->>'name',v_item->>'normalized_name',nullif(v_item->>'email',''),nullif(v_item->>'normalized_email',''),p_actor);
    v_n:=v_n+1;
  end loop;
  insert into public.attendance_changes(import_id,actor_id,action) values(v_import,p_actor,'roster_imported');
  return jsonb_build_object('ok',true,'id',v_import,'rowCount',v_n);
exception when unique_violation or foreign_key_violation or check_violation then return '{"ok":false}'::jsonb;
end; $$;

create or replace function public.admin_commit_attendance_report_import(
  p_actor uuid, p_cohort_id uuid, p_session_id uuid, p_file_name text, p_rows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_import uuid; v_item jsonb; v_row uuid; v_n integer:=0; v_minutes integer; v_pct numeric;
begin
  if not exists (select 1 from public.admin_members where user_id=p_actor and active=true and role in ('owner','coordinator')) then return '{"ok":false}'::jsonb; end if;
  if p_file_name is null or char_length(btrim(p_file_name)) not between 1 and 160 or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 1000 then return '{"ok":false}'::jsonb; end if;
  select duration_minutes into v_minutes from public.attendance_sessions where id=p_session_id and cohort_id=p_cohort_id and status<>'cancelled' for update;
  if not found then return '{"ok":false}'::jsonb; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where char_length(coalesce(x->>'name','')) not between 1 and 160 or char_length(coalesce(x->>'normalized_name','')) not between 1 and 160 or coalesce((x->>'duration_seconds')::integer,-1) not between 0 and 86400 or (x->>'decision' not in ('matched','unmatched'))) then return '{"ok":false}'::jsonb; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where x->>'participant_id' is not null and not exists(select 1 from public.attendance_participants p where p.id=(x->>'participant_id')::uuid and p.cohort_id=p_cohort_id and p.active and p.normalized_name=x->>'normalized_name')) then return '{"ok":false}'::jsonb; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where x->>'participant_id' is not null group by x->>'participant_id' having count(*)>1) then return '{"ok":false}'::jsonb; end if;
  insert into public.attendance_imports(cohort_id,session_id,import_type,status,source_file_name,row_count,summary,imported_by,confirmed_by,confirmed_at)
  values(p_cohort_id,p_session_id,'report','confirmed',btrim(p_file_name),jsonb_array_length(p_rows),jsonb_build_object('rows',jsonb_array_length(p_rows)),p_actor,p_actor,now()) returning id into v_import;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    insert into public.attendance_import_rows(import_id,row_number,raw_name,normalized_name,raw_duration,attended_seconds,joined_at_text,participant_id,match_status,duplicate_name,reviewed_by,reviewed_at)
    values(v_import,(v_item->>'row_number')::integer,v_item->>'name',v_item->>'normalized_name',v_item->>'duration_seconds',(v_item->>'duration_seconds')::integer,nullif(v_item->>'joined_at',''),nullif(v_item->>'participant_id','')::uuid,case when v_item->>'participant_id' is null then 'unmatched' else 'confirmed' end,coalesce((v_item->>'duplicate_name')::boolean,false),p_actor,now()) returning id into v_row;
    if v_item->>'participant_id' is not null then
      v_pct:=least(100,round(((v_item->>'duration_seconds')::numeric/(v_minutes*60))*100,2));
      insert into public.attendance_records(session_id,participant_id,import_id,attended_seconds,attendance_percent,first_join_text,confirmed_by)
      values(p_session_id,(v_item->>'participant_id')::uuid,v_import,(v_item->>'duration_seconds')::integer,v_pct,nullif(v_item->>'joined_at',''),p_actor);
      insert into public.attendance_changes(import_id,import_row_id,participant_id,actor_id,action)
      values(v_import,v_row,(v_item->>'participant_id')::uuid,p_actor,'report_confirmed');
    else
      insert into public.attendance_changes(import_id,import_row_id,actor_id,action) values(v_import,v_row,p_actor,'row_left_unmatched');
    end if;
    v_n:=v_n+1;
  end loop;
  return jsonb_build_object('ok',true,'id',v_import,'rowCount',v_n);
exception when unique_violation or foreign_key_violation or check_violation or invalid_text_representation then return '{"ok":false}'::jsonb;
end; $$;

revoke all on function public.admin_commit_attendance_roster_import(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.admin_commit_attendance_report_import(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.admin_commit_attendance_roster_import(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.admin_commit_attendance_report_import(uuid,uuid,uuid,text,jsonb) to service_role;
