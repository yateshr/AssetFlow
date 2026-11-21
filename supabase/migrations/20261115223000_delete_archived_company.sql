create or replace function public.assetflow_delete_company(p_company_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_name text;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only a workspace administrator can permanently delete companies'; end if;
  select name into v_name from companies where id=p_company_id and not active;
  if v_name is null then raise exception 'Only an archived company can be permanently deleted'; end if;
  if exists(select 1 from asset_transfers where source_company_id=p_company_id or target_company_id=p_company_id) then
    raise exception 'Cannot delete % because it is referenced by inter-company asset transfer history',v_name;
  end if;
  delete from invoice_line_items where company_id=p_company_id;
  delete from assignments where company_id=p_company_id;
  delete from asset_history where company_id=p_company_id;
  delete from audit_logs where company_id=p_company_id;
  delete from assets where company_id=p_company_id;
  delete from invoices where company_id=p_company_id;
  delete from software_licenses where company_id=p_company_id;
  delete from call_logs where company_id=p_company_id;
  delete from app_users where company_id=p_company_id;
  delete from locations where company_id=p_company_id;
  delete from vendors where company_id=p_company_id;
  delete from departments where company_id=p_company_id;
  delete from asset_categories where company_id=p_company_id;
  delete from master_data where company_id=p_company_id;
  delete from app_kv where company_id=p_company_id;
  delete from companies where id=p_company_id;
end $$;

grant execute on function public.assetflow_delete_company(uuid) to authenticated;
