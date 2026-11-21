-- Keep the relational table names for compatibility, but migrate every portal payload
-- to the siteId contract before the first production deployment.
set local session_replication_role = replica;
update public.app_users set data=data||jsonb_build_object('siteId',data->>'locationId') where data ? 'locationId';
update public.departments set data=data||jsonb_build_object('siteId',data->>'locationId') where data ? 'locationId';
update public.invoices set data=data||jsonb_build_object('siteId',data->>'locationId') where data ? 'locationId';
update public.call_logs set data=data||jsonb_build_object('siteId',data->>'locationId') where data ? 'locationId';
update public.asset_history set data=data||jsonb_build_object('siteId',data->>'locationId') where data ? 'locationId';
set local session_replication_role = origin;

-- Existing scope functions still use relational location columns. Keep that
-- compatibility value synchronized until those physical table names are retired.
create or replace function public.assetflow_sync_legacy_site_key()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.data ? 'siteId' then new.data:=new.data||jsonb_build_object('locationId',new.data->>'siteId'); end if;
  return new;
end $$;

drop trigger if exists aa_sync_site_key_users on public.app_users;
drop trigger if exists aa_sync_site_key_departments on public.departments;
drop trigger if exists aa_sync_site_key_invoices on public.invoices;
drop trigger if exists aa_sync_site_key_call_logs on public.call_logs;
drop trigger if exists aa_sync_site_key_history on public.asset_history;
create trigger aa_sync_site_key_users before insert or update on public.app_users for each row execute function public.assetflow_sync_legacy_site_key();
create trigger aa_sync_site_key_departments before insert or update on public.departments for each row execute function public.assetflow_sync_legacy_site_key();
create trigger aa_sync_site_key_invoices before insert or update on public.invoices for each row execute function public.assetflow_sync_legacy_site_key();
create trigger aa_sync_site_key_call_logs before insert or update on public.call_logs for each row execute function public.assetflow_sync_legacy_site_key();
create trigger aa_sync_site_key_history before insert or update on public.asset_history for each row execute function public.assetflow_sync_legacy_site_key();

create or replace function public.assetflow_request_transfer(p_request jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); v_workspace uuid; v_source uuid:=(p_request->>'sourceCompanyId')::uuid; v_target uuid:=(p_request->>'targetCompanyId')::uuid; v_target_site text;
begin
  if public.assetflow_is_workspace_admin() then raise exception 'Super Admin can complete transfers directly; a request is not required'; end if;
  if not public.assetflow_can_access_company(v_source) or not public.assetflow_site_allowed(v_source,coalesce(p_request->>'sourceSiteId','')) then raise exception 'You do not have access to the source site'; end if;
  select coalesce(nullif(p_request->>'targetSiteId',''),primary_location_id) into v_target_site from companies where id=v_target;
  if v_source=v_target and coalesce(p_request->>'sourceSiteId','')=coalesce(v_target_site,'') and coalesce(trim(p_request->>'targetDepartment'),'')='' then raise exception 'Choose a different target site, department, or company'; end if;
  select workspace_id into v_workspace from companies where id=v_source;
  insert into transfer_requests(id,workspace_id,request_type,source_company_id,source_location_id,target_company_id,target_location_id,target_department,entity_id,reason,requested_asset_tag)
  values(v_id,v_workspace,p_request->>'requestType',v_source,nullif(p_request->>'sourceSiteId',''),v_target,nullif(v_target_site,''),nullif(trim(p_request->>'targetDepartment'),''),p_request->>'entityId',trim(p_request->>'reason'),nullif(trim(p_request->>'newAssetTag'),''));
  return v_id;
end $$;

create or replace function public.assetflow_transfer_employee(p_source_company_id uuid,p_target_company_id uuid,p_employee_id text,p_target_site_id text,p_target_department text,p_reason text default '')
returns void language plpgsql security definer set search_path=public as $$
declare v_data jsonb;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only Super Admin can transfer employees directly'; end if;
  if not exists(select 1 from companies where id=p_source_company_id and workspace_id=(select workspace_id from companies where id=p_target_company_id)) then raise exception 'Companies must belong to the same workspace'; end if;
  if not exists(select 1 from locations where company_id=p_target_company_id and id=p_target_site_id) then raise exception 'Target site does not belong to the target company'; end if;
  select data into v_data from app_users where company_id=p_source_company_id and id=p_employee_id for update;
  if v_data is null then raise exception 'Source employee was not found'; end if;
  if p_source_company_id=p_target_company_id then
    update app_users set data=data||jsonb_build_object('locationId',p_target_site_id,'siteId',p_target_site_id,'department',p_target_department),updated_at=now() where company_id=p_source_company_id and id=p_employee_id;
  else
    insert into app_users(company_id,id,data) values(p_target_company_id,p_employee_id,v_data||jsonb_build_object('locationId',p_target_site_id,'siteId',p_target_site_id,'department',p_target_department)) on conflict(company_id,id) do update set data=excluded.data,updated_at=now();
    delete from app_users where company_id=p_source_company_id and id=p_employee_id;
  end if;
end $$;

create or replace function public.assetflow_save_company(p_company jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_workspace uuid; v_id uuid; v_active boolean;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only a workspace administrator can manage companies'; end if;
  select id into v_workspace from workspaces order by created_at limit 1; v_id:=coalesce(nullif(p_company->>'id','')::uuid,gen_random_uuid()); v_active:=coalesce((p_company->>'active')::boolean,true);
  if not v_active and (select count(*) from companies where active and id<>v_id)=0 then raise exception 'At least one company must remain active'; end if;
  insert into companies(id,workspace_id,name,legal_name,code,default_currency,timezone,active,registered_address,registered_country,registered_state,registered_city,billing_address,tax_id,contact_email,contact_phone,primary_location_id)
  values(v_id,v_workspace,trim(p_company->>'name'),nullif(trim(p_company->>'legalName'),''),upper(trim(p_company->>'code')),coalesce(nullif(p_company->>'defaultCurrency',''),'INR'),coalesce(nullif(p_company->>'timezone',''),'Asia/Kolkata'),v_active,nullif(trim(p_company->>'registeredAddress'),''),nullif(trim(p_company->>'registeredCountry'),''),nullif(trim(p_company->>'registeredState'),''),nullif(trim(p_company->>'registeredCity'),''),nullif(trim(p_company->>'billingAddress'),''),nullif(trim(p_company->>'taxId'),''),nullif(trim(p_company->>'contactEmail'),''),nullif(trim(p_company->>'contactPhone'),''),nullif(p_company->>'primarySiteId',''))
  on conflict(id) do update set name=excluded.name,legal_name=excluded.legal_name,code=excluded.code,default_currency=excluded.default_currency,timezone=excluded.timezone,active=excluded.active,registered_address=excluded.registered_address,registered_country=excluded.registered_country,registered_state=excluded.registered_state,registered_city=excluded.registered_city,billing_address=excluded.billing_address,tax_id=excluded.tax_id,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,primary_location_id=excluded.primary_location_id,updated_at=now();
  insert into company_members(company_id,auth_user_id,role) values(v_id,auth.uid(),'admin') on conflict do nothing; return v_id;
end $$;

grant execute on function public.assetflow_request_transfer(jsonb) to authenticated;
grant execute on function public.assetflow_transfer_employee(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.assetflow_save_company(jsonb) to authenticated;
