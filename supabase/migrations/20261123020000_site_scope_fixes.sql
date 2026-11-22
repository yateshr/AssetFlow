-- Site IT admins work in one plant only. This closes three gaps found in testing:
--  1. They could not save changes to their OWN plant's assets: the check read a generated column that
--     is still empty while the row is being written. It now reads the asset's own siteId.
--  2. They could delete other plants' assets, invoices and sites, because deletes had no site check.
--  3. They could take over another plant's asset by saving it again with their own site. The row being
--     replaced is now checked too.
-- Company-wide settings (asset types, policies, reference lists) are changed by company-wide users only,
-- and the audit trail cannot be deleted by anyone except an administrator.

-- ---------------------------------------------------------------- who may write what
create or replace function public.assetflow_can_write_company(p_company_id uuid,p_collection text)
returns boolean language sql stable security definer set search_path=public as $$
  select (
    public.assetflow_is_workspace_admin()
    or exists(select 1 from company_members cm where cm.company_id=p_company_id and cm.auth_user_id=auth.uid()
      and (cm.role='admin' or (cm.role in ('manager','technician') and p_collection not in ('users','system-policies'))))
    or exists(select 1 from company_access_grants g where g.company_id=p_company_id and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')) and g.active
      and (g.role='admin' or (g.role in ('manager','technician') and p_collection not in ('users','system-policies'))))
  ) and (
    p_collection not in ('asset-categories','system-policies','currencies','units-of-measure','payment-methods','payment-terms',
      'asset-conditions','license-types','call-categories','call-priorities','support-teams','location-types','infrastructure-types')
    or public.assetflow_has_all_sites(p_company_id)
  )
$$;

-- ---------------------------------------------------------------- site of a stored row
create or replace function public.assetflow_row_site(p_data jsonb)
returns text language sql immutable as $$
  select coalesce(nullif(p_data->>'siteId',''), nullif(p_data->>'location',''), nullif(p_data->>'locationId',''), '')
$$;

-- ---------------------------------------------------------------- writes: check the new AND the old site
create or replace function public.assetflow_enforce_site_scope()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_new text; v_old text;
begin
  if tg_table_name='locations' then v_new:=new.id; v_old:=case when tg_op='UPDATE' then old.id end;
  elsif tg_table_name in ('assets','app_users','invoices','call_logs') then
    v_new:=public.assetflow_row_site(new.data);
    v_old:=case when tg_op='UPDATE' then public.assetflow_row_site(old.data) end;
  elsif tg_table_name='site_areas' then v_new:=new.site_id; v_old:=case when tg_op='UPDATE' then old.site_id end;
  else return new; end if;
  if not public.assetflow_site_allowed(new.company_id,v_new) then raise exception 'Your access is limited to another site'; end if;
  if v_old is not null and not public.assetflow_site_allowed(new.company_id,v_old) then raise exception 'Your access is limited to another site'; end if;
  return new;
end $$;

-- ---------------------------------------------------------------- deletes: site check, protected audit trail
create or replace function public.assetflow_delete_company_records(p_company_id uuid,p_collection text,p_ids text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) or not public.assetflow_can_write_company(p_company_id,p_collection) then raise exception 'Not allowed'; end if;
  if p_collection in ('history','audit-logs') and not public.assetflow_is_workspace_admin() then raise exception 'The audit trail cannot be deleted'; end if;

  if p_collection='assets' and exists(select 1 from assets x where x.company_id=p_company_id and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,public.assetflow_row_site(x.data))) then raise exception 'You can only delete records for your assigned site'; end if;
  if p_collection='invoices' and exists(select 1 from invoices x where x.company_id=p_company_id and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,public.assetflow_row_site(x.data))) then raise exception 'You can only delete records for your assigned site'; end if;
  if p_collection='call-logs' and exists(select 1 from call_logs x where x.company_id=p_company_id and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,public.assetflow_row_site(x.data))) then raise exception 'You can only delete records for your assigned site'; end if;
  if p_collection='departments' and exists(select 1 from departments x where x.company_id=p_company_id and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,public.assetflow_row_site(x.data))) then raise exception 'You can only delete records for your assigned site'; end if;
  if p_collection='locations' and exists(select 1 from locations x where x.company_id=p_company_id and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,x.id)) then raise exception 'You can only delete records for your assigned site'; end if;
  if p_collection='assignments' and exists(select 1 from assignments x join assets a on a.company_id=x.company_id and a.id=x.data->>'assetId'
      where x.company_id=p_company_id and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,public.assetflow_row_site(a.data))) then raise exception 'You can only delete records for your assigned site'; end if;

  case p_collection
    when 'users' then delete from app_users where company_id=p_company_id and id=any(p_ids);
    when 'departments' then delete from departments where company_id=p_company_id and id=any(p_ids);
    when 'locations' then delete from locations where company_id=p_company_id and id=any(p_ids);
    when 'vendors' then delete from vendors where company_id=p_company_id and id=any(p_ids);
    when 'asset-categories' then delete from asset_categories where company_id=p_company_id and id=any(p_ids);
    when 'assets' then delete from assets where company_id=p_company_id and id=any(p_ids);
    when 'invoices' then delete from invoices where company_id=p_company_id and id=any(p_ids);
    when 'assignments' then delete from assignments where company_id=p_company_id and id=any(p_ids);
    when 'history' then delete from asset_history where company_id=p_company_id and id=any(p_ids);
    when 'call-logs' then delete from call_logs where company_id=p_company_id and id=any(p_ids);
    when 'licenses' then delete from software_licenses where company_id=p_company_id and id=any(p_ids);
    when 'audit-logs' then delete from audit_logs where company_id=p_company_id and id=any(p_ids);
    when 'kv' then delete from app_kv where company_id=p_company_id and id=any(p_ids);
    else delete from master_data where company_id=p_company_id and collection=p_collection and id=any(p_ids);
  end case;
end $$;
grant execute on function public.assetflow_delete_company_records(uuid,text,text[]) to authenticated;
