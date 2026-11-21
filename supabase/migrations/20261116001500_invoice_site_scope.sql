-- Site-scoped invoice access. Invoice location lives in the JSON record so it
-- can be added without changing existing customer tables.
create or replace function public.assetflow_read_company_records(p_company_id uuid)
returns table(collection text,id text,data jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) then raise exception 'You do not have access to this company'; end if;
  return query
  select 'users',x.id,x.data,x.created_at from app_users x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,x.location_id) union all
  select 'departments',x.id,x.data,x.created_at from departments x where x.company_id=p_company_id union all
  select 'locations',x.id,x.data,x.created_at from locations x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,x.id) union all
  select 'site-areas',x.id,x.data,x.created_at from site_areas x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,x.site_id) union all
  select 'vendors',x.id,x.data,x.created_at from vendors x where x.company_id=p_company_id union all
  select 'asset-categories',x.id,x.data,x.created_at from asset_categories x where x.company_id=p_company_id union all
  select 'assets',x.id,x.data,x.created_at from assets x where x.company_id=p_company_id and coalesce((x.data->>'transferredOut')::boolean,false)=false and public.assetflow_site_allowed(p_company_id,x.location_id) union all
  select 'invoices',x.id,x.data,x.created_at from invoices x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,coalesce(x.data->>'locationId','')) union all
  select 'assignments',x.id,x.data,x.created_at from assignments x where x.company_id=p_company_id and exists(select 1 from assets a where a.company_id=p_company_id and a.id=x.asset_id and public.assetflow_site_allowed(p_company_id,a.location_id)) union all
  select 'history',x.id,x.data,x.created_at from asset_history x where x.company_id=p_company_id and exists(select 1 from assets a where a.company_id=p_company_id and a.id=x.asset_id and public.assetflow_site_allowed(p_company_id,a.location_id)) union all
  select 'call-logs',x.id,x.data,x.created_at from call_logs x where x.company_id=p_company_id union all
  select 'licenses',x.id,x.data,x.created_at from software_licenses x where x.company_id=p_company_id union all
  select 'audit-logs',x.id,x.data,x.created_at from audit_logs x where x.company_id=p_company_id union all
  select x.collection,x.id,x.data,x.created_at from master_data x where x.company_id=p_company_id union all
  select 'kv',x.id,x.data,x.updated_at from app_kv x where x.company_id=p_company_id;
end $$;

create or replace function public.assetflow_upsert_company_records(p_company_id uuid,p_collection text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) or not public.assetflow_can_write_company(p_company_id,p_collection) then raise exception 'Not allowed'; end if;
  if p_collection='assets' and exists(select 1 from jsonb_array_elements(p_items) x where not public.assetflow_site_allowed(p_company_id,coalesce(x->>'location',''))) then raise exception 'You can only save assets for your assigned location'; end if;
  if p_collection='invoices' and exists(select 1 from jsonb_array_elements(p_items) x where not public.assetflow_site_allowed(p_company_id,coalesce(x->>'locationId',''))) then raise exception 'You can only save invoices for your assigned location'; end if;
  case p_collection
    when 'users' then insert into app_users(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'departments' then insert into departments(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'locations' then insert into locations(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'vendors' then insert into vendors(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'asset-categories' then insert into asset_categories(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'assets' then insert into assets(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'invoices' then
      insert into invoices(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
      delete from invoice_line_items where company_id=p_company_id and invoice_id in(select x->>'id' from jsonb_array_elements(p_items)x);
      insert into invoice_line_items(company_id,id,invoice_id,data) select p_company_id,item->>'id',x->>'id',item from jsonb_array_elements(p_items)x cross join lateral jsonb_array_elements(coalesce(x->'lineItems','[]'::jsonb))item;
    when 'assignments' then insert into assignments(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'history' then insert into asset_history(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'call-logs' then insert into call_logs(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'licenses' then insert into software_licenses(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'audit-logs' then insert into audit_logs(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'kv' then insert into app_kv(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    else insert into master_data(company_id,collection,id,data) select p_company_id,p_collection,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,collection,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
  end case;
end $$;
