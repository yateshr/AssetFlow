-- Support teams work across sites. Call location is operational context, not a
-- read restriction; assets and invoices remain site-scoped.
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

drop trigger if exists call_logs_site_scope on public.call_logs;
