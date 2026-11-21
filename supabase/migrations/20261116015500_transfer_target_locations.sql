create or replace function public.assetflow_list_transfer_locations(p_source_company_id uuid,p_target_company_id uuid)
returns table(id text,name text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_source_company_id) then raise exception 'You do not have access to the source company'; end if;
  if not exists(select 1 from companies source join companies target on target.workspace_id=source.workspace_id where source.id=p_source_company_id and target.id=p_target_company_id) then raise exception 'Target company is not in the same workspace'; end if;
  return query select location.id,coalesce(location.data->>'name',location.id) from locations location where location.company_id=p_target_company_id order by coalesce(location.data->>'name',location.id);
end $$;

grant execute on function public.assetflow_list_transfer_locations(uuid,uuid) to authenticated;
