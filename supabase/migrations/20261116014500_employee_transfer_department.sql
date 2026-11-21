alter table public.transfer_requests add column if not exists target_department text;

create or replace function public.assetflow_request_transfer(p_request jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); v_workspace uuid; v_source uuid:=(p_request->>'sourceCompanyId')::uuid; v_target uuid:=(p_request->>'targetCompanyId')::uuid; v_target_site text;
begin
  if public.assetflow_is_workspace_admin() then raise exception 'Super Admin can complete transfers directly; a request is not required'; end if;
  if not public.assetflow_can_access_company(v_source) or not public.assetflow_site_allowed(v_source,coalesce(p_request->>'sourceLocationId','')) then raise exception 'You do not have access to the source location'; end if;
  select coalesce(nullif(p_request->>'targetLocationId',''),primary_location_id) into v_target_site from companies where id=v_target;
  if v_source=v_target and coalesce(p_request->>'sourceLocationId','')=coalesce(v_target_site,'') and coalesce(trim(p_request->>'targetDepartment'),'')='' then raise exception 'Choose a different target location, department, or company'; end if;
  select workspace_id into v_workspace from companies where id=v_source;
  insert into transfer_requests(id,workspace_id,request_type,source_company_id,source_location_id,target_company_id,target_location_id,target_department,entity_id,reason,requested_asset_tag)
  values(v_id,v_workspace,p_request->>'requestType',v_source,nullif(p_request->>'sourceLocationId',''),v_target,nullif(v_target_site,''),nullif(trim(p_request->>'targetDepartment'),''),p_request->>'entityId',trim(p_request->>'reason'),nullif(trim(p_request->>'newAssetTag'),''));
  return v_id;
end $$;

create or replace function public.assetflow_transfer_employee(p_source_company_id uuid,p_target_company_id uuid,p_employee_id text,p_target_site_id text,p_target_department text,p_reason text default '')
returns void language plpgsql security definer set search_path=public as $$
declare v_data jsonb;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only Super Admin can transfer employees directly'; end if;
  if not exists(select 1 from companies where id=p_source_company_id and workspace_id=(select workspace_id from companies where id=p_target_company_id)) then raise exception 'Companies must belong to the same workspace'; end if;
  if not exists(select 1 from locations where company_id=p_target_company_id and id=p_target_site_id) then raise exception 'Target location does not belong to the target company'; end if;
  select data into v_data from app_users where company_id=p_source_company_id and id=p_employee_id for update;
  if v_data is null then raise exception 'Source employee was not found'; end if;
  if p_source_company_id=p_target_company_id then
    update app_users set data=data||jsonb_build_object('locationId',p_target_site_id,'department',p_target_department),updated_at=now() where company_id=p_source_company_id and id=p_employee_id;
  else
    insert into app_users(company_id,id,data) values(p_target_company_id,p_employee_id,v_data||jsonb_build_object('locationId',p_target_site_id,'department',p_target_department)) on conflict(company_id,id) do update set data=excluded.data,updated_at=now();
    delete from app_users where company_id=p_source_company_id and id=p_employee_id;
  end if;
end $$;

create or replace function public.assetflow_decide_transfer(p_request_id uuid,p_approve boolean,p_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare r transfer_requests%rowtype; v_tag text;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only Super Admin can approve transfer requests'; end if;
  select * into r from transfer_requests where id=p_request_id for update;
  if not found then raise exception 'Transfer request not found'; end if;
  if r.status<>'pending' then raise exception 'This transfer request has already been decided'; end if;
  if not p_approve then update transfer_requests set status='rejected',decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note) where id=r.id; return; end if;
  if r.request_type='asset' then
    select coalesce(nullif(r.requested_asset_tag,''),asset_tag) into v_tag from assets where company_id=r.source_company_id and id=r.entity_id;
    if v_tag is null then raise exception 'Source asset was not found'; end if;
    if r.source_company_id=r.target_company_id then update assets set data=data||jsonb_build_object('location',coalesce(r.target_location_id,''),'assignedTo',null,'status','available'),updated_at=now() where company_id=r.source_company_id and id=r.entity_id;
    else perform public.assetflow_transfer_asset(r.source_company_id,r.target_company_id,r.entity_id,r.target_location_id,v_tag,coalesce(r.reason,'')); end if;
  else
    perform public.assetflow_transfer_employee(r.source_company_id,r.target_company_id,r.entity_id,r.target_location_id,coalesce(r.target_department,''),coalesce(r.reason,''));
  end if;
  update transfer_requests set status='approved',decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note) where id=r.id;
end $$;

drop function if exists public.assetflow_list_transfer_requests();
create function public.assetflow_list_transfer_requests()
returns table(id uuid,request_type text,source_company_id uuid,source_location_id text,target_company_id uuid,target_location_id text,target_department text,entity_id text,reason text,requested_asset_tag text,status text,requested_at timestamptz,decision_note text)
language sql stable security definer set search_path=public as $$
  select r.id,r.request_type,r.source_company_id,r.source_location_id,r.target_company_id,r.target_location_id,r.target_department,r.entity_id,r.reason,r.requested_asset_tag,r.status,r.requested_at,r.decision_note from transfer_requests r where public.assetflow_is_workspace_admin() or r.requested_by=auth.uid() order by r.requested_at desc
$$;

grant execute on function public.assetflow_transfer_employee(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.assetflow_request_transfer(jsonb) to authenticated;
grant execute on function public.assetflow_decide_transfer(uuid,boolean,text) to authenticated;
grant execute on function public.assetflow_list_transfer_requests() to authenticated;
