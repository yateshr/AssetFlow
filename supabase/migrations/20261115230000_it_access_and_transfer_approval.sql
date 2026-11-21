-- Employees are directory records only. Portal accounts must first receive a
-- company/site IT access grant from a workspace administrator.
create or replace function public.app_signup_allowed(p_email text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.app_needs_setup()
    or exists(select 1 from company_access_grants where lower(email)=lower(p_email) and active)
$$;

-- Direct ownership movement is reserved for the workspace-level Super Admin.
-- Site IT admins must create a transfer request (the request workflow is
-- introduced below and carries the approval decision separately).
create table if not exists public.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  request_type text not null check(request_type in ('asset','employee')),
  source_company_id uuid not null references public.companies(id),
  source_location_id text,
  target_company_id uuid not null references public.companies(id),
  target_location_id text,
  entity_id text not null,
  reason text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  requested_by uuid not null default auth.uid(),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text
);

create or replace function public.assetflow_request_transfer(p_request jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); v_workspace uuid; v_source uuid:=(p_request->>'sourceCompanyId')::uuid; v_target uuid:=(p_request->>'targetCompanyId')::uuid;
begin
  if public.assetflow_is_workspace_admin() then raise exception 'Super Admin can complete transfers directly; a request is not required'; end if;
  if not public.assetflow_can_access_company(v_source) or not public.assetflow_site_allowed(v_source,coalesce(p_request->>'sourceLocationId','')) then raise exception 'You do not have access to the source location'; end if;
  if v_source=v_target and coalesce(p_request->>'sourceLocationId','')=coalesce(p_request->>'targetLocationId','') then raise exception 'Choose a different target location or company'; end if;
  select workspace_id into v_workspace from companies where id=v_source;
  insert into transfer_requests(id,workspace_id,request_type,source_company_id,source_location_id,target_company_id,target_location_id,entity_id,reason)
  values(v_id,v_workspace,p_request->>'requestType',v_source,nullif(p_request->>'sourceLocationId',''),v_target,nullif(p_request->>'targetLocationId',''),p_request->>'entityId',trim(p_request->>'reason'));
  return v_id;
end $$;

create or replace function public.assetflow_list_transfer_requests()
returns table(id uuid,request_type text,source_company_id uuid,source_location_id text,target_company_id uuid,target_location_id text,entity_id text,reason text,status text,requested_at timestamptz,decision_note text)
language sql stable security definer set search_path=public as $$
 select r.id,r.request_type,r.source_company_id,r.source_location_id,r.target_company_id,r.target_location_id,r.entity_id,r.reason,r.status,r.requested_at,r.decision_note from transfer_requests r
 where public.assetflow_is_workspace_admin() or r.requested_by=auth.uid() order by r.requested_at desc
$$;

grant execute on function public.app_signup_allowed(text) to anon,authenticated;
grant execute on function public.assetflow_request_transfer(jsonb) to authenticated;
grant execute on function public.assetflow_list_transfer_requests() to authenticated;
revoke all on public.transfer_requests from anon,authenticated;

create or replace function public.assetflow_transfer_asset(p_source_company_id uuid,p_target_company_id uuid,p_asset_id text,p_target_site_id text,p_new_asset_tag text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_asset assets%rowtype; v_data jsonb; v_workspace uuid;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only the Super Admin can complete a company transfer. Submit a transfer request for approval.'; end if;
  if p_source_company_id=p_target_company_id then raise exception 'Choose a different target company'; end if;
  select * into v_asset from assets where company_id=p_source_company_id and id=p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if coalesce(v_asset.data->>'assignedTo','')<>'' then raise exception 'Return the asset from its current employee before transferring it'; end if;
  if p_target_site_id is not null and not exists(select 1 from locations where company_id=p_target_company_id and id=p_target_site_id) then raise exception 'Target site does not belong to the target company'; end if;
  v_data:=v_asset.data || jsonb_build_object('assetTag',p_new_asset_tag,'location',coalesce(p_target_site_id,''),'assignedTo',null,'vendorId',null,'invoiceId',null,'notes',concat_ws(E'\n',v_asset.data->>'notes','Transferred between companies: '||p_reason));
  insert into assets(company_id,id,data) values(p_target_company_id,p_asset_id,v_data);
  update assets set data=data||jsonb_build_object('transferredOut',true,'transferredToCompanyId',p_target_company_id,'status','disposed'),updated_at=now() where company_id=p_source_company_id and id=p_asset_id;
  select workspace_id into v_workspace from companies where id=p_source_company_id;
  insert into asset_transfers(workspace_id,asset_id,asset_tag_before,asset_tag_after,source_company_id,target_company_id,target_site_id,reason) values(v_workspace,p_asset_id,v_asset.asset_tag,p_new_asset_tag,p_source_company_id,p_target_company_id,p_target_site_id,p_reason);
end $$;
