-- An employee ID (Code) belongs to exactly one employee in a company. Names and departments can repeat;
-- the ID cannot. Compared ignoring capital letters; an empty ID is not checked.
do $$
begin
  if exists(
    select 1 from public.app_users
    where coalesce(data->>'employeeId','')<>''
    group by company_id, lower(data->>'employeeId') having count(*)>1
  ) then
    raise exception 'Some employees share the same employee ID. Make the IDs unique, then apply this migration again.';
  end if;
end $$;

create unique index if not exists app_users_company_employee_id_uq
  on public.app_users (company_id, lower(data->>'employeeId'))
  where coalesce(data->>'employeeId','')<>'';
