-- Enterprise access scopes, site hierarchy, consolidated reporting and asset transfers.

create table public.company_access_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check(role in ('admin','manager','technician','viewer')),
  site_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,email,site_id)
);
create index company_access_email_idx on public.company_access_grants(lower(email),active);

create table public.site_areas (
  row_id uuid not null default gen_random_uuid() unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  id text not null,
  site_id text not null,
  parent_id text,
  data jsonb not null,
  name text generated always as (data->>'name') stored,
  area_type text generated always as (data->>'type') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key(company_id,id),
  foreign key(company_id,site_id) references public.locations(company_id,id) on delete cascade,
  foreign key(company_id,parent_id) references public.site_areas(company_id,id) on delete cascade
);
create index site_areas_site_idx on public.site_areas(company_id,site_id,parent_id);

create table public.asset_transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  asset_id text not null,
  asset_tag_before text,
  asset_tag_after text,
  source_company_id uuid not null references public.companies(id),
  target_company_id uuid not null references public.companies(id),
  target_site_id text,
  reason text not null,
  transferred_by uuid default auth.uid(),
  transferred_at timestamptz not null default now()
);

create or replace function public.assetflow_can_access_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.assetflow_is_workspace_admin()
  or exists(select 1 from company_members where company_id=p_company_id and auth_user_id=auth.uid())
  or exists(select 1 from company_access_grants where company_id=p_company_id and lower(email)=lower(coalesce(auth.jwt()->>'email','')) and active)
$$;

create or replace function public.assetflow_can_write_company(p_company_id uuid,p_collection text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.assetflow_is_workspace_admin()
  or exists(select 1 from company_members cm where cm.company_id=p_company_id and cm.auth_user_id=auth.uid()
    and (cm.role='admin' or (cm.role in ('manager','technician') and p_collection not in ('users','system-policies'))))
  or exists(select 1 from company_access_grants g where g.company_id=p_company_id and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')) and g.active
    and (g.role='admin' or (g.role in ('manager','technician') and p_collection not in ('users','system-policies'))))
$$;

create or replace function public.assetflow_has_all_sites(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.assetflow_is_workspace_admin()
  or exists(select 1 from company_members where company_id=p_company_id and auth_user_id=auth.uid())
  or exists(select 1 from company_access_grants where company_id=p_company_id and lower(email)=lower(coalesce(auth.jwt()->>'email','')) and active and site_id is null)
$$;
create or replace function public.assetflow_site_allowed(p_company_id uuid,p_site_id text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.assetflow_has_all_sites(p_company_id) or exists(select 1 from company_access_grants where company_id=p_company_id and lower(email)=lower(coalesce(auth.jwt()->>'email','')) and active and site_id=p_site_id)
$$;

create or replace function public.assetflow_enforce_site_scope()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_site text;
begin
  if tg_table_name='locations' then v_site:=new.id;
  elsif tg_table_name='app_users' then v_site:=new.location_id;
  elsif tg_table_name='assets' then v_site:=new.location_id;
  elsif tg_table_name='site_areas' then v_site:=new.site_id;
  else return new; end if;
  if not public.assetflow_site_allowed(new.company_id,v_site) then raise exception 'Your access is limited to another site'; end if;
  return new;
end $$;
create trigger locations_site_scope before insert or update on public.locations for each row execute function public.assetflow_enforce_site_scope();
create trigger users_site_scope before insert or update on public.app_users for each row execute function public.assetflow_enforce_site_scope();
create trigger assets_site_scope before insert or update on public.assets for each row execute function public.assetflow_enforce_site_scope();
create trigger site_areas_site_scope before insert or update on public.site_areas for each row execute function public.assetflow_enforce_site_scope();

create or replace function public.assetflow_company_context()
returns table(id uuid,name text,legal_name text,code text,default_currency text,timezone text,active boolean,access_role text)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.legal_name,c.code,c.default_currency,c.timezone,c.active,
    coalesce((select cm.role from company_members cm where cm.company_id=c.id and cm.auth_user_id=auth.uid() limit 1),
      (select g.role from company_access_grants g where g.company_id=c.id and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')) and g.active order by case g.role when 'admin' then 1 when 'manager' then 2 when 'technician' then 3 else 4 end limit 1),
      case when public.assetflow_is_workspace_admin() then 'admin' end)
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
  insert into companies(id,workspace_id,name,legal_name,code,default_currency,timezone,active)
  values(v_id,v_workspace,trim(p_company->>'name'),nullif(trim(p_company->>'legalName'),''),upper(trim(p_company->>'code')),
    coalesce(nullif(p_company->>'defaultCurrency',''),'INR'),coalesce(nullif(p_company->>'timezone',''),'Asia/Kolkata'),v_active)
  on conflict(id) do update set name=excluded.name,legal_name=excluded.legal_name,code=excluded.code,
    default_currency=excluded.default_currency,timezone=excluded.timezone,active=excluded.active,updated_at=now();
  insert into company_members(company_id,auth_user_id,role) values(v_id,auth.uid(),'admin') on conflict do nothing;
  return v_id;
end $$;

create or replace function public.assetflow_list_access_grants()
returns table(id uuid,company_id uuid,email text,role text,site_id text,active boolean)
language sql stable security definer set search_path=public as $$
  select g.id,g.company_id,g.email,g.role,g.site_id,g.active from company_access_grants g
  where public.assetflow_is_workspace_admin() order by g.email,g.company_id
$$;

create or replace function public.assetflow_save_access_grant(p_grant jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only a workspace administrator can manage access'; end if;
  v_id:=coalesce(nullif(p_grant->>'id','')::uuid,gen_random_uuid());
  insert into company_access_grants(id,company_id,email,role,site_id,active)
  values(v_id,(p_grant->>'companyId')::uuid,lower(trim(p_grant->>'email')),p_grant->>'role',nullif(p_grant->>'siteId',''),coalesce((p_grant->>'active')::boolean,true))
  on conflict(id) do update set company_id=excluded.company_id,email=excluded.email,role=excluded.role,site_id=excluded.site_id,active=excluded.active,updated_at=now();
  return v_id;
end $$;

create or replace function public.assetflow_consolidated_summary()
returns table(company_id uuid,company_name text,company_code text,sites bigint,users bigint,assets bigint,assigned bigint,maintenance bigint,asset_value numeric,open_calls bigint,invoice_total numeric)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.code,
    (select count(*) from locations x where x.company_id=c.id),
    (select count(*) from app_users x where x.company_id=c.id and x.status='active'),
    (select count(*) from assets x where x.company_id=c.id and coalesce((x.data->>'transferredOut')::boolean,false)=false),
    (select count(*) from assets x where x.company_id=c.id and x.status='assigned' and coalesce((x.data->>'transferredOut')::boolean,false)=false),
    (select count(*) from assets x where x.company_id=c.id and x.status='maintenance' and coalesce((x.data->>'transferredOut')::boolean,false)=false),
    coalesce((select sum(coalesce((x.data->>'purchasePrice')::numeric,0)) from assets x where x.company_id=c.id and coalesce((x.data->>'transferredOut')::boolean,false)=false),0),
    (select count(*) from call_logs x where x.company_id=c.id and x.status in ('open','in-progress')),
    coalesce((select sum(coalesce((x.data->>'total')::numeric,0)) from invoices x where x.company_id=c.id),0)
  from companies c where c.active and public.assetflow_can_access_company(c.id) order by c.name
$$;

create or replace function public.assetflow_transfer_asset(p_source_company_id uuid,p_target_company_id uuid,p_asset_id text,p_target_site_id text,p_new_asset_tag text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_asset assets%rowtype; v_data jsonb; v_workspace uuid;
begin
  if not public.assetflow_can_write_company(p_source_company_id,'assets') or not public.assetflow_can_write_company(p_target_company_id,'assets') then raise exception 'You need write access to both companies'; end if;
  if p_source_company_id=p_target_company_id then raise exception 'Choose a different target company'; end if;
  select * into v_asset from assets where company_id=p_source_company_id and id=p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  if coalesce(v_asset.data->>'assignedTo','')<>'' then raise exception 'Return the asset from its current user before transferring it'; end if;
  if p_target_site_id is not null and not exists(select 1 from locations where company_id=p_target_company_id and id=p_target_site_id) then raise exception 'Target site does not belong to the target company'; end if;
  v_data:=v_asset.data || jsonb_build_object('assetTag',p_new_asset_tag,'location',coalesce(p_target_site_id,''),'assignedTo',null,'vendorId',null,'invoiceId',null,'notes',concat_ws(E'\n',v_asset.data->>'notes','Transferred between companies: '||p_reason));
  insert into assets(company_id,id,data) values(p_target_company_id,p_asset_id,v_data);
  update assets set data=data||jsonb_build_object('transferredOut',true,'transferredToCompanyId',p_target_company_id,'status','disposed'),updated_at=now()
  where company_id=p_source_company_id and id=p_asset_id;
  select workspace_id into v_workspace from companies where id=p_source_company_id;
  insert into asset_transfers(workspace_id,asset_id,asset_tag_before,asset_tag_after,source_company_id,target_company_id,target_site_id,reason)
  values(v_workspace,p_asset_id,v_asset.asset_tag,p_new_asset_tag,p_source_company_id,p_target_company_id,p_target_site_id,p_reason);
end $$;

-- Extend collection compatibility for hierarchical site areas.
create or replace function public.assetflow_read_company_records(p_company_id uuid)
returns table(collection text,id text,data jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) then raise exception 'You do not have access to this company'; end if;
  return query
  select 'users',x.id,x.data,x.created_at from app_users x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,x.location_id) union all select 'departments',x.id,x.data,x.created_at from departments x where x.company_id=p_company_id union all
  select 'locations',x.id,x.data,x.created_at from locations x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,x.id) union all select 'site-areas',x.id,x.data,x.created_at from site_areas x where x.company_id=p_company_id and public.assetflow_site_allowed(p_company_id,x.site_id) union all
  select 'vendors',x.id,x.data,x.created_at from vendors x where x.company_id=p_company_id union all select 'asset-categories',x.id,x.data,x.created_at from asset_categories x where x.company_id=p_company_id union all
  select 'assets',x.id,x.data,x.created_at from assets x where x.company_id=p_company_id and coalesce((x.data->>'transferredOut')::boolean,false)=false and public.assetflow_site_allowed(p_company_id,x.location_id) union all select 'invoices',x.id,x.data,x.created_at from invoices x where x.company_id=p_company_id union all
  select 'assignments',x.id,x.data,x.created_at from assignments x where x.company_id=p_company_id and exists(select 1 from assets a where a.company_id=p_company_id and a.id=x.asset_id and public.assetflow_site_allowed(p_company_id,a.location_id)) union all select 'history',x.id,x.data,x.created_at from asset_history x where x.company_id=p_company_id and exists(select 1 from assets a where a.company_id=p_company_id and a.id=x.asset_id and public.assetflow_site_allowed(p_company_id,a.location_id)) union all
  select 'call-logs',x.id,x.data,x.created_at from call_logs x where x.company_id=p_company_id union all select 'licenses',x.id,x.data,x.created_at from software_licenses x where x.company_id=p_company_id union all
  select 'audit-logs',x.id,x.data,x.created_at from audit_logs x where x.company_id=p_company_id union all select x.collection,x.id,x.data,x.created_at from master_data x where x.company_id=p_company_id union all
  select 'kv',x.id,x.data,x.updated_at from app_kv x where x.company_id=p_company_id;
end $$;

-- Wrap existing collection writers to handle site areas, delegating other collections to the previous implementation is impossible after replace;
-- therefore site areas receive dedicated RPCs and remain part of hydration.
create or replace function public.assetflow_save_site_areas(p_company_id uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_write_company(p_company_id,'locations') then raise exception 'Not allowed'; end if;
  insert into site_areas(company_id,id,site_id,parent_id,data)
  select p_company_id,x->>'id',x->>'siteId',nullif(x->>'parentId',''),x from jsonb_array_elements(p_items)x
  on conflict(company_id,id) do update set site_id=excluded.site_id,parent_id=excluded.parent_id,data=excluded.data,updated_at=now(),updated_by=auth.uid();
end $$;
create or replace function public.assetflow_delete_site_areas(p_company_id uuid,p_ids text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_write_company(p_company_id,'locations') then raise exception 'Not allowed'; end if;
  delete from site_areas where company_id=p_company_id and id=any(p_ids);
end $$;

grant execute on function public.assetflow_list_access_grants() to authenticated;
grant execute on function public.assetflow_save_access_grant(jsonb) to authenticated;
grant execute on function public.assetflow_consolidated_summary() to authenticated;
grant execute on function public.assetflow_transfer_asset(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.assetflow_save_site_areas(uuid,jsonb) to authenticated;
grant execute on function public.assetflow_delete_site_areas(uuid,text[]) to authenticated;
revoke all on public.company_access_grants,public.site_areas,public.asset_transfers from anon,authenticated;
