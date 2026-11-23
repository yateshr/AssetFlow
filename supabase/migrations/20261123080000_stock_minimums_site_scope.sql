-- Minimum stock levels are kept per site ('stock-minimums' in master_data: { siteId, type, min }).
-- A site IT admin may set them for their own plant only; company-wide users may set them for any site.

create or replace function public.assetflow_enforce_master_site_scope()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_old text;
begin
  if new.collection='stock-minimums' then
    if not public.assetflow_site_allowed(new.company_id,public.assetflow_row_site(new.data)) then raise exception 'Your access is limited to another site'; end if;
    if tg_op='UPDATE' then
      v_old:=public.assetflow_row_site(old.data);
      if v_old<>'' and not public.assetflow_site_allowed(new.company_id,v_old) then raise exception 'Your access is limited to another site'; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists master_data_site_scope on public.master_data;
create trigger master_data_site_scope before insert or update on public.master_data
  for each row execute function public.assetflow_enforce_master_site_scope();

-- Deleting a minimum is checked the same way.
do $$
declare def text;
begin
  def:=pg_get_functiondef('public.assetflow_delete_company_records(uuid,text,text[])'::regprocedure);
  if position('stock-minimums' in def)=0 then
    def:=replace(def,
      'if p_collection in (''history'',''audit-logs'') and not public.assetflow_is_workspace_admin() then raise exception ''The audit trail cannot be deleted''; end if;',
      'if p_collection in (''history'',''audit-logs'') and not public.assetflow_is_workspace_admin() then raise exception ''The audit trail cannot be deleted''; end if;'||chr(10)||
      '  if p_collection=''stock-minimums'' and exists(select 1 from master_data x where x.company_id=p_company_id and x.collection=''stock-minimums'' and x.id=any(p_ids) and not public.assetflow_site_allowed(p_company_id,public.assetflow_row_site(x.data))) then raise exception ''You can only delete records for your assigned site''; end if;');
    if position('stock-minimums' in def)=0 then raise exception 'Could not patch the delete function'; end if;
    execute def;
  end if;
end $$;
