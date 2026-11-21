alter table public.companies
  add column if not exists registered_address text,
  add column if not exists billing_address text,
  add column if not exists tax_id text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists primary_location_id text;

drop function if exists public.assetflow_company_context();
create function public.assetflow_company_context()
returns table(id uuid,name text,legal_name text,code text,default_currency text,timezone text,active boolean,access_role text,registered_address text,billing_address text,tax_id text,contact_email text,contact_phone text,primary_location_id text)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.legal_name,c.code,c.default_currency,c.timezone,c.active,
    coalesce((select cm.role from company_members cm where cm.company_id=c.id and cm.auth_user_id=auth.uid() limit 1),
      (select g.role from company_access_grants g where g.company_id=c.id and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')) and g.active order by case g.role when 'admin' then 1 when 'manager' then 2 when 'technician' then 3 else 4 end limit 1),
      case when public.assetflow_is_workspace_admin() then 'admin' end),
    c.registered_address,c.billing_address,c.tax_id,c.contact_email,c.contact_phone,c.primary_location_id
  from companies c where public.assetflow_is_workspace_admin() or (c.active and public.assetflow_can_access_company(c.id))
  order by c.active desc,c.name
$$;

create or replace function public.assetflow_save_company(p_company jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_workspace uuid; v_id uuid; v_active boolean;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only a workspace administrator can manage companies'; end if;
  select id into v_workspace from workspaces order by created_at limit 1;
  v_id:=coalesce(nullif(p_company->>'id','')::uuid,gen_random_uuid());
  v_active:=coalesce((p_company->>'active')::boolean,true);
  if not v_active and (select count(*) from companies where active and id<>v_id)=0 then raise exception 'At least one company must remain active'; end if;
  insert into companies(id,workspace_id,name,legal_name,code,default_currency,timezone,active,registered_address,billing_address,tax_id,contact_email,contact_phone,primary_location_id)
  values(v_id,v_workspace,trim(p_company->>'name'),nullif(trim(p_company->>'legalName'),''),upper(trim(p_company->>'code')),coalesce(nullif(p_company->>'defaultCurrency',''),'INR'),coalesce(nullif(p_company->>'timezone',''),'Asia/Kolkata'),v_active,nullif(trim(p_company->>'registeredAddress'),''),nullif(trim(p_company->>'billingAddress'),''),nullif(trim(p_company->>'taxId'),''),nullif(trim(p_company->>'contactEmail'),''),nullif(trim(p_company->>'contactPhone'),''),nullif(p_company->>'primaryLocationId',''))
  on conflict(id) do update set name=excluded.name,legal_name=excluded.legal_name,code=excluded.code,default_currency=excluded.default_currency,timezone=excluded.timezone,active=excluded.active,registered_address=excluded.registered_address,billing_address=excluded.billing_address,tax_id=excluded.tax_id,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,primary_location_id=excluded.primary_location_id,updated_at=now();
  insert into company_members(company_id,auth_user_id,role) values(v_id,auth.uid(),'admin') on conflict do nothing;
  return v_id;
end $$;

grant execute on function public.assetflow_company_context() to authenticated;
grant execute on function public.assetflow_save_company(jsonb) to authenticated;
