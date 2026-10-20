-- Separate student class from section without rewriting existing student rows.
-- Legacy Core/VLSI/DS values in section are retained as-is; student_class stays
-- NULL until each existing student is explicitly assigned a class.
alter table public.profiles
  add column if not exists student_class text;

alter table public.profiles
  drop constraint if exists profiles_section_check;

alter table public.profiles
  add constraint profiles_section_check
  check (section is null or section in ('A', 'B', 'Core', 'VLSI', 'DS'));

alter table public.profiles
  drop constraint if exists profiles_student_class_check;

alter table public.profiles
  add constraint profiles_student_class_check
  check (student_class is null or student_class in ('Core', 'VLSI', 'DS'));

grant select(student_class) on public.profiles to authenticated;

-- Keep staff invitation provisioning intact. New student Auth metadata now
-- stores independent section and student_class values.
create or replace function public.provision_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  department_row public.departments%rowtype;
  invitation public.staff_account_invitations%rowtype;
  profile_name text;
  register_no text;
  section_value text;
  class_value text;
  year_value text;
  department_code text;
  provisioned_profile_id uuid;
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'srmist.edu.in' then
    raise exception 'Only @srmist.edu.in accounts can use this application.' using errcode = '23514';
  end if;

  select * into invitation
  from public.staff_account_invitations
  where email = lower(new.email)
    and auth_user_id is null
    and claimed_at is null
    and expires_at > now()
  for update;
  if invitation.id is not null then
    select * into department_row
    from public.departments
    where id = invitation.department_id and is_active = true;
    if department_row.id is null or department_row.code <> 'ECE' then
      raise exception 'The invited ECE department is not active.' using errcode = '23503';
    end if;

    insert into public.profiles(auth_user_id, full_name, email, role, department_id, is_active, must_change_password, staff_setup_pending)
    values(new.id, split_part(new.email, '@', 1), lower(new.email), invitation.role, invitation.department_id, false, false, true)
    on conflict(email) do update set
      auth_user_id = excluded.auth_user_id,
      role = excluded.role,
      department_id = excluded.department_id,
      is_active = false,
      must_change_password = false,
      staff_setup_pending = true,
      updated_at = now()
    where public.profiles.staff_setup_pending = true
      and public.profiles.role = excluded.role
      and public.profiles.department_id = excluded.department_id
    returning id into provisioned_profile_id;
    if provisioned_profile_id is null then
      raise exception 'This email is already linked to a non-pending profile.' using errcode = '23505';
    end if;

    update public.staff_account_invitations
    set auth_user_id = new.id, claimed_at = now()
    where id = invitation.id;
    return new;
  end if;

  profile_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')), '');
  register_no := upper(trim(coalesce(new.raw_user_meta_data->>'register_number', '')));
  section_value := upper(trim(coalesce(new.raw_user_meta_data->>'section', '')));
  class_value := case upper(trim(coalesce(new.raw_user_meta_data->>'student_class', '')))
    when 'CORE' then 'Core'
    when 'VLSI' then 'VLSI'
    when 'DS' then 'DS'
    else upper(trim(coalesce(new.raw_user_meta_data->>'student_class', '')))
  end;
  year_value := upper(trim(coalesce(new.raw_user_meta_data->>'year', '')));
  department_code := upper(trim(coalesce(new.raw_user_meta_data->>'department_code', '')));

  if profile_name is null or length(profile_name) not between 2 and 120
    or register_no !~ '^RA[A-Z0-9]{6,18}$'
    or section_value not in ('A', 'B')
    or class_value not in ('Core', 'VLSI', 'DS')
    or year_value not in ('I', 'II', 'III', 'IV')
    or department_code <> 'ECE' then
    raise exception 'Required student profile information is invalid.' using errcode = '23514';
  end if;

  select * into department_row
  from public.departments
  where code = department_code and is_active = true
  limit 1;
  if department_row.id is null or department_row.code <> 'ECE' then
    raise exception 'The selected ECE department is not active.' using errcode = '23503';
  end if;

  insert into public.profiles
    (auth_user_id, full_name, email, role, department_id, register_number, section, student_class, year, is_active)
  values
    (new.id, profile_name, lower(new.email), 'student'::public.user_role, department_row.id, register_no, section_value, class_value, year_value, true);
  return new;
end;
$$;

revoke all on function public.provision_student_profile_for_auth_user() from public, anon, authenticated;

-- Versioned RPC avoids changing the established function's return signature.
create or replace function public.admin_profile_directory_v2(p_search text default null)
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  register_number text,
  section text,
  student_class text,
  department_name text,
  department_code text,
  is_active boolean,
  created_at timestamptz,
  must_change_password boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles;
  term text := nullif(trim(p_search), '');
begin
  actor := public.active_profile_or_error();
  if actor.role <> 'admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, p.email, p.role, p.register_number, p.section, p.student_class,
         d.name, d.code, p.is_active, p.created_at, p.must_change_password
  from public.profiles p
  left join public.departments d on d.id = p.department_id
  where term is null
     or position(lower(term) in lower(coalesce(p.full_name, ''))) > 0
     or position(lower(term) in lower(p.email)) > 0
     or position(lower(term) in lower(coalesce(p.register_number, ''))) > 0
     or position(lower(term) in lower(coalesce(p.section, ''))) > 0
     or position(lower(term) in lower(coalesce(p.student_class, ''))) > 0
  order by p.full_name
  limit 1000;
end;
$$;

revoke all on function public.admin_profile_directory_v2(text) from public, anon;
grant execute on function public.admin_profile_directory_v2(text) to authenticated;
