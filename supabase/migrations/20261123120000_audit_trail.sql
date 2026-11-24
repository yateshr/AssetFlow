-- Audit trail. Until now nothing wrote to audit_logs: only asset lifecycle events were shown, so changes to
-- employees, sites, departments, vendors, invoices and assets (bulk imports included) left no trace.
-- A database trigger records every create, change and delete with who did it, so it cannot be skipped by the app.
create or replace function public.assetflow_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_kind text;
  v_name text;
  v_user text;
  v_details text;
  v_action text;
  v_site text;
  v_ref text;
  v_id text := 'AUD-' || replace(gen_random_uuid()::text, '-', '');
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) -> 'data' else to_jsonb(new) -> 'data' end;
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) -> 'data' end;
  v_kind := case tg_table_name
    when 'app_users' then case when coalesce(v_row->>'role','user') = 'user' then 'Employee' else 'Login' end
    when 'locations' then 'Site' when 'departments' then 'Department' when 'vendors' then 'Vendor'
    when 'invoices' then 'Invoice' when 'assets' then 'Asset' when 'asset_categories' then 'Category'
    else tg_table_name end;
  v_name := coalesce(nullif(v_row->>'name',''), nullif(v_row->>'assetTag',''), nullif(v_row->>'invoiceNumber',''), v_row->>'id');
  -- A person reads a site name and an employee code, not a database id.
  select l.data->>'name' into v_site from public.locations l
    where l.company_id = (case when tg_op = 'DELETE' then old.company_id else new.company_id end) and l.id = v_row->>'siteId';
  v_ref := case tg_table_name
    when 'app_users' then coalesce(nullif(v_row->>'employeeId',''), nullif(v_row->>'email',''), v_row->>'id')
    when 'assets' then coalesce(nullif(v_row->>'assetTag',''), v_row->>'id')
    when 'invoices' then coalesce(nullif(v_row->>'invoiceNumber',''), v_row->>'id')
    when 'locations' then coalesce(nullif(v_row->>'siteCode',''), v_row->>'id')
    when 'departments' then coalesce(v_site, '')
    else v_row->>'id' end;
  v_action := case tg_op when 'INSERT' then 'Created' when 'UPDATE' then 'Updated' else 'Deleted' end;

  if tg_op = 'UPDATE' then
    select string_agg(k || ': ' || coalesce(nullif(v_old->>k,''),'(empty)') || ' → ' || coalesce(nullif(v_row->>k,''),'(empty)'), '; ' order by k)
      into v_details
      from jsonb_object_keys(v_row) k
      where k not in ('id','updatedAt','createdAt') and jsonb_typeof(v_row->k) in ('string','number','boolean','null')
        and (v_old->k) is distinct from (v_row->k);
    if v_details is null then return new; end if;   -- nothing the person would recognise changed
    if length(v_details) > 600 then v_details := left(v_details, 600) || '…'; end if;
  end if;

  -- The person is found by the e-mail of the signed-in account (app_users ids are not auth ids).
  select coalesce(u.data->>'name', au.email) into v_user from auth.users au
    left join public.app_users u on u.email = lower(au.email) and u.company_id = (case when tg_op = 'DELETE' then old.company_id else new.company_id end)
    where au.id = auth.uid();

  insert into public.audit_logs(company_id, id, data)
  values (
    case when tg_op = 'DELETE' then old.company_id else new.company_id end,
    v_id,
    jsonb_build_object(
      'id', v_id,
      'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'action', v_action, 'entityType', v_kind,
      'entityId', coalesce(v_ref, ''), 'entityName', coalesce(v_name, ''),
      'userId', coalesce(auth.uid()::text, ''), 'userName', coalesce(v_user, case when auth.uid() is null then 'System' else 'Signed-in user' end),
      'details', coalesce(v_details, case when tg_op = 'INSERT' then 'New ' || lower(v_kind) || coalesce(' at ' || v_site, '') when tg_op = 'DELETE' then lower(v_kind) || ' removed' else '' end)
    ));
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['app_users','locations','departments','vendors','invoices','assets','asset_categories'] loop
    execute format('drop trigger if exists zz_audit on public.%I', t);
    execute format('create trigger zz_audit after insert or update or delete on public.%I for each row execute function public.assetflow_audit()', t);
  end loop;
end $$;
