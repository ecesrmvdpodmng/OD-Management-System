-- Attendance is read-only for faculty. Final HOD approval creates Present
-- attendance records, while preserving any historical explicit mark.

create or replace function public.mark_approved_od_attendance_present(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  actor public.profiles := public.active_profile_or_error();
  request_row public.od_requests;
begin
  if actor.role <> 'hod' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into request_row from public.od_requests where id = p_request_id for update;
  if request_row.id is null or request_row.status <> 'APPROVED'
     or request_row.hod_id <> actor.id or request_row.department_id <> actor.department_id then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  insert into public.od_attendance as existing_attendance
    (request_id, student_id, attendance_status, marked_by, marked_at)
  select p_request_id, students.student_id, 'PRESENT'::public.attendance_status, actor.id, now()
  from public.od_request_students as students where students.request_id = p_request_id
  on conflict (request_id, student_id) do update
    set attendance_status = 'PRESENT'::public.attendance_status,
        marked_by = coalesce(existing_attendance.marked_by, excluded.marked_by),
        marked_at = coalesce(existing_attendance.marked_at, excluded.marked_at),
        updated_at = now()
    where existing_attendance.attendance_status = 'NOT_MARKED';
end;
$$;
revoke all on function public.mark_approved_od_attendance_present(uuid) from public, anon, authenticated;

-- Existing explicit marks are preserved; missing/NOT_MARKED entries for final
-- approvals become Present without changing rejected or pending requests.
insert into public.od_attendance as existing_attendance
  (request_id, student_id, attendance_status, marked_by, marked_at)
select r.id, students.student_id, 'PRESENT'::public.attendance_status, r.hod_id,
       coalesce(r.hod_action_at, r.updated_at, r.created_at, now())
from public.od_requests as r
join public.od_request_students as students on students.request_id = r.id
where r.status = 'APPROVED' and r.hod_id is not null
on conflict (request_id, student_id) do update
  set attendance_status = 'PRESENT'::public.attendance_status,
      marked_by = coalesce(existing_attendance.marked_by, excluded.marked_by),
      marked_at = coalesce(existing_attendance.marked_at, excluded.marked_at),
      updated_at = now()
  where existing_attendance.attendance_status = 'NOT_MARKED';

create or replace function public.decide_od_request_hod(p_request_id uuid,p_approved boolean,p_remarks text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor public.profiles := public.active_profile_or_error(); request_row public.od_requests; next_status public.od_status;
begin
  if actor.role<>'hod' or (not p_approved and nullif(trim(p_remarks),'') is null) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  select * into request_row from public.od_requests where id=p_request_id for update;
  if request_row.id is null or coalesce(request_row.is_special_od,false) or request_row.department_id<>actor.department_id or request_row.status<>'PENDING_HOD'
    or request_row.faculty_id is null or not exists(select 1 from public.od_request_faculty where od_request_id=p_request_id and faculty_id=request_row.faculty_id and status='APPROVED') then raise exception 'INVALID_STATUS_TRANSITION' using errcode='P0001'; end if;
  next_status := case when p_approved then 'APPROVED'::public.od_status else 'REJECTED_BY_HOD'::public.od_status end;
  update public.od_requests set status=next_status,hod_id=actor.id,hod_action_at=now(),hod_remarks=nullif(trim(p_remarks),''),hod_rejection_reason=case when p_approved then null else trim(p_remarks) end,updated_at=now() where id=p_request_id;
  if p_approved then perform public.mark_approved_od_attendance_present(p_request_id); end if;
  insert into public.od_approval_history(od_request_id,actor_id,actor_role,action,from_status,to_status,remarks) values(p_request_id,actor.id,'hod',case when p_approved then 'HOD_APPROVED' else 'HOD_REJECTED' end,'PENDING_HOD',next_status,p_remarks);
  insert into public.notifications(user_id,od_request_id,notification_type,title,message)
    select distinct target.user_id,p_request_id,case when p_approved then 'HOD_APPROVED' else 'HOD_REJECTED' end,case when p_approved then 'OD request approved' else 'OD request rejected by HOD' end,
      coalesce(nullif(trim(p_remarks),''),case when p_approved then 'Your OD request has been approved.' else 'Your OD request was rejected by the HOD.' end)
    from (select request_row.requester_id user_id union select student_id from public.od_request_students where request_id=p_request_id union select faculty_id from public.od_request_faculty where od_request_id=p_request_id) target;
end $$;
revoke all on function public.decide_od_request_hod(uuid,boolean,text) from public,anon;
grant execute on function public.decide_od_request_hod(uuid,boolean,text) to authenticated;

create or replace function public.decide_special_od_hod(p_request_id uuid,p_approved boolean,p_remarks text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor public.profiles := public.active_profile_or_error(); request_row public.od_requests; next_status public.od_status;
begin
  if actor.role<>'hod' or (not p_approved and nullif(trim(p_remarks),'') is null) then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  select * into request_row from public.od_requests where id=p_request_id for update;
  if request_row.id is null or not request_row.is_special_od or request_row.department_id<>actor.department_id or request_row.status<>'PENDING_HOD'
    or not exists(select 1 from public.od_request_faculty where od_request_id=p_request_id)
    or exists(select 1 from public.od_request_faculty where od_request_id=p_request_id and status<>'APPROVED') then raise exception 'INVALID_STATUS_TRANSITION' using errcode='P0001'; end if;
  next_status := case when p_approved then 'APPROVED'::public.od_status else 'REJECTED_BY_HOD'::public.od_status end;
  update public.od_requests set status=next_status,hod_id=actor.id,hod_action_at=now(),hod_remarks=nullif(trim(p_remarks),''),hod_rejection_reason=case when p_approved then null else trim(p_remarks) end,updated_at=now() where id=p_request_id;
  if p_approved then perform public.mark_approved_od_attendance_present(p_request_id); end if;
  insert into public.od_approval_history(od_request_id,actor_id,actor_role,action,from_status,to_status,remarks)
    values(p_request_id,actor.id,'hod',case when p_approved then 'SPECIAL_OD_HOD_APPROVED' else 'SPECIAL_OD_HOD_REJECTED' end,'PENDING_HOD',next_status,p_remarks);
  insert into public.notifications(user_id,od_request_id,notification_type,title,message)
    values(request_row.requester_id,p_request_id,case when p_approved then 'SPECIAL_OD_HOD_APPROVED' else 'SPECIAL_OD_HOD_REJECTED' end,
      case when p_approved then 'Your Special OD was approved by HOD.' else 'Your Special OD was rejected by HOD.' end,
      case when p_approved then 'Your Special OD was approved by HOD.' else 'Your Special OD was rejected by HOD. '||coalesce(nullif(trim(p_remarks),''),'') end);
end $$;
revoke all on function public.decide_special_od_hod(uuid,boolean,text) from public,anon;
grant execute on function public.decide_special_od_hod(uuid,boolean,text) to authenticated;

-- Department-wide attendance access is exposed only through this guarded RPC;
-- the underlying RLS policies remain unchanged and faculty-scoped.
create or replace function public.faculty_approved_od_attendance()
returns table (
  request_id uuid, od_number text, student_id uuid, student_name text,
  register_number text, major text, minor text, section text, event_name text,
  event_date date, reason text, attendance_status public.attendance_status
)
language plpgsql stable security definer set search_path=public set row_security=off as $$
declare actor public.profiles := public.active_profile_or_error();
begin
  if actor.role <> 'faculty' or actor.department_id is null then raise exception 'FORBIDDEN' using errcode='P0001'; end if;
  return query
  select r.id, r.od_number, student.id, student.full_name, student.register_number,
         student.major, student.minor, student.section, r.event_name, r.event_date,
         coalesce(r.purpose, r.reason), coalesce(attendance.attendance_status, 'PRESENT'::public.attendance_status)
  from public.od_requests r
  join public.od_request_students request_student on request_student.request_id = r.id
  join public.profiles student on student.id = request_student.student_id
  left join public.od_attendance attendance on attendance.request_id = r.id and attendance.student_id = student.id
  where r.status='APPROVED' and r.department_id=actor.department_id
    and student.role='student' and student.is_active and student.major is not null
    and student.minor is not null and student.section in ('A','B')
  order by r.event_date desc, r.od_number, student.full_name;
end;
$$;
revoke all on function public.faculty_approved_od_attendance() from public, anon;
grant execute on function public.faculty_approved_od_attendance() to authenticated;

-- Keep the legacy RPC for migration compatibility but disable client marking.
revoke all on function public.mark_od_attendance(uuid,uuid,public.attendance_status) from public,anon,authenticated;

notify pgrst, 'reload schema';
