-- Multi-company workspace and company-scoped data access.
-- One AssetFlow deployment owns one workspace; that workspace can contain
-- many legal companies and each company can contain many physical sites.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  legal_name text,
  code text not null,
  default_currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code),
  unique(workspace_id,name)
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key(workspace_id,auth_user_id)
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','manager','technician','viewer')),
  created_at timestamptz not null default now(),
  primary key(company_id,auth_user_id)
);

insert into public.workspaces(id,name)
select id,name from public.organizations order by created_at limit 1
on conflict(id) do nothing;

insert into public.companies(id,workspace_id,name,legal_name,code)
select id,id,name,name,'PRIMARY' from public.organizations order by created_at limit 1
on conflict(id) do nothing;

insert into public.workspace_members(workspace_id,auth_user_id,role)
select o.id,u.id,'owner' from public.organizations o cross join auth.users u
join public.app_users a on a.email=lower(u.email) and a.role='admin'
on conflict do nothing;

insert into public.company_members(company_id,auth_user_id,role)
select o.id,u.id,case when a.role='admin' then 'admin' when a.role='manager' then 'manager' else 'viewer' end
from public.organizations o cross join auth.users u join public.app_users a on a.email=lower(u.email)
on conflict do nothing;

-- Physical sites are intentionally separate from geographic labels. A site is
-- the operational office/factory/warehouse/data centre to which people and
-- assets belong; country/state/city describe where it is.
alter table public.locations add column if not exists company_id uuid references public.companies(id);
update public.locations set company_id=organization_id where company_id is null;
alter table public.locations alter column company_id set not null;
create index if not exists locations_company_idx on public.locations(company_id);

do $$
declare t text;
begin
  foreach t in array array['app_users','departments','vendors','asset_categories','assets','invoices','invoice_line_items','assignments','asset_history','call_logs','software_licenses','audit_logs','master_data','app_kv'] loop
    execute format('alter table public.%I add column if not exists company_id uuid references public.companies(id)',t);
    execute format('update public.%I set company_id=organization_id where company_id is null',t);
    execute format('alter table public.%I alter column company_id set not null',t);
    execute format('create index if not exists %I on public.%I(company_id)',t||'_company_idx',t);
  end loop;
end $$;

-- Portal IDs are only required to be unique inside a company. This permits two
-- companies to use the same asset tag, vendor code, default category ID, etc.
alter table public.assets drop constraint if exists assets_vendor_fk;
alter table public.assets drop constraint if exists assets_invoice_fk;
alter table public.assets drop constraint if exists assets_assigned_user_fk;
alter table public.invoices drop constraint if exists invoices_vendor_fk;
alter table public.assignments drop constraint if exists assignments_asset_fk;
alter table public.assignments drop constraint if exists assignments_user_fk;
alter table public.asset_history drop constraint if exists asset_history_asset_fk;
alter table public.invoice_line_items drop constraint if exists invoice_line_items_invoice_id_fkey;

do $$
declare t text;
begin
  foreach t in array array['app_users','departments','locations','vendors','asset_categories','assets','invoices','invoice_line_items','assignments','asset_history','call_logs','software_licenses','audit_logs','app_kv'] loop
    execute format('alter table public.%I drop constraint if exists %I',t,t||'_pkey');
    execute format('alter table public.%I add primary key(company_id,id)',t);
  end loop;
end $$;
alter table public.master_data drop constraint if exists master_data_pkey;
alter table public.master_data add primary key(company_id,collection,id);

drop index if exists public.app_users_org_email_uq;
drop index if exists public.departments_org_name_uq;
drop index if exists public.locations_org_name_uq;
drop index if exists public.vendors_org_name_uq;
drop index if exists public.assets_org_tag_uq;
drop index if exists public.assets_org_serial_uq;
create unique index app_users_company_email_uq on public.app_users(company_id,email);
create unique index departments_company_name_uq on public.departments(company_id,lower(name));
create unique index locations_company_name_uq on public.locations(company_id,lower(name));
create unique index vendors_company_name_uq on public.vendors(company_id,lower(name));
create unique index assets_company_tag_uq on public.assets(company_id,lower(asset_tag)) where asset_tag is not null and asset_tag<>'';
create unique index assets_company_serial_uq on public.assets(company_id,lower(serial_number)) where serial_number is not null and serial_number<>'';

alter table public.assets add constraint assets_vendor_company_fk foreign key(company_id,vendor_id) references public.vendors(company_id,id) not valid;
alter table public.assets add constraint assets_invoice_company_fk foreign key(company_id,invoice_id) references public.invoices(company_id,id) not valid;
alter table public.assets add constraint assets_user_company_fk foreign key(company_id,assigned_user_id) references public.app_users(company_id,id) not valid;
alter table public.invoices add constraint invoices_vendor_company_fk foreign key(company_id,vendor_id) references public.vendors(company_id,id) not valid;
alter table public.invoice_line_items add constraint invoice_items_invoice_company_fk foreign key(company_id,invoice_id) references public.invoices(company_id,id) on delete cascade;
alter table public.assignments add constraint assignments_asset_company_fk foreign key(company_id,asset_id) references public.assets(company_id,id) not valid;
alter table public.assignments add constraint assignments_user_company_fk foreign key(company_id,user_id) references public.app_users(company_id,id) not valid;
alter table public.asset_history add constraint history_asset_company_fk foreign key(company_id,asset_id) references public.assets(company_id,id) not valid;

create or replace function public.assetflow_is_workspace_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from workspace_members where auth_user_id=auth.uid() and role in ('owner','admin'))
  or exists(select 1 from app_users where email=lower(coalesce(auth.jwt()->>'email','')) and role='admin' and status='active')
  or not exists(select 1 from app_users)
$$;

create or replace function public.assetflow_can_access_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.assetflow_is_workspace_admin()
  or exists(select 1 from company_members where company_id=p_company_id and auth_user_id=auth.uid())
$$;

create or replace function public.assetflow_can_write_company(p_company_id uuid,p_collection text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.assetflow_is_workspace_admin() or exists(
    select 1 from company_members cm where cm.company_id=p_company_id and cm.auth_user_id=auth.uid()
    and (cm.role='admin' or (cm.role in ('manager','technician') and p_collection not in ('users','system-policies')))
  )
$$;

create or replace function public.assetflow_company_context()
returns table(id uuid,name text,legal_name text,code text,default_currency text,timezone text,active boolean,access_role text)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.legal_name,c.code,c.default_currency,c.timezone,c.active,
    coalesce(cm.role,case when public.assetflow_is_workspace_admin() then 'admin' end)
  from companies c left join company_members cm on cm.company_id=c.id and cm.auth_user_id=auth.uid()
  where c.active and (public.assetflow_is_workspace_admin() or cm.auth_user_id is not null)
  order by c.name
$$;

create or replace function public.assetflow_save_company(p_company jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_workspace uuid; v_id uuid;
begin
  if not public.assetflow_is_workspace_admin() then raise exception 'Only a workspace administrator can manage companies'; end if;
  select id into v_workspace from workspaces order by created_at limit 1;
  v_id:=coalesce(nullif(p_company->>'id','')::uuid,gen_random_uuid());
  insert into companies(id,workspace_id,name,legal_name,code,default_currency,timezone,active)
  values(v_id,v_workspace,trim(p_company->>'name'),nullif(trim(p_company->>'legalName'),''),upper(trim(p_company->>'code')),
    coalesce(nullif(p_company->>'defaultCurrency',''),'INR'),coalesce(nullif(p_company->>'timezone',''),'Asia/Kolkata'),coalesce((p_company->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,legal_name=excluded.legal_name,code=excluded.code,
    default_currency=excluded.default_currency,timezone=excluded.timezone,active=excluded.active,updated_at=now();
  insert into company_members(company_id,auth_user_id,role) values(v_id,auth.uid(),'admin') on conflict do nothing;
  return v_id;
end $$;

create or replace function public.assetflow_read_company_records(p_company_id uuid)
returns table(collection text,id text,data jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) then raise exception 'You do not have access to this company'; end if;
  return query
  select 'users',x.id,x.data,x.created_at from app_users x where x.company_id=p_company_id union all
  select 'departments',x.id,x.data,x.created_at from departments x where x.company_id=p_company_id union all
  select 'locations',x.id,x.data,x.created_at from locations x where x.company_id=p_company_id union all
  select 'vendors',x.id,x.data,x.created_at from vendors x where x.company_id=p_company_id union all
  select 'asset-categories',x.id,x.data,x.created_at from asset_categories x where x.company_id=p_company_id union all
  select 'assets',x.id,x.data,x.created_at from assets x where x.company_id=p_company_id union all
  select 'invoices',x.id,x.data,x.created_at from invoices x where x.company_id=p_company_id union all
  select 'assignments',x.id,x.data,x.created_at from assignments x where x.company_id=p_company_id union all
  select 'history',x.id,x.data,x.created_at from asset_history x where x.company_id=p_company_id union all
  select 'call-logs',x.id,x.data,x.created_at from call_logs x where x.company_id=p_company_id union all
  select 'licenses',x.id,x.data,x.created_at from software_licenses x where x.company_id=p_company_id union all
  select 'audit-logs',x.id,x.data,x.created_at from audit_logs x where x.company_id=p_company_id union all
  select x.collection,x.id,x.data,x.created_at from master_data x where x.company_id=p_company_id union all
  select 'kv',x.id,x.data,x.updated_at from app_kv x where x.company_id=p_company_id;
end $$;

create or replace function public.assetflow_upsert_company_records(p_company_id uuid,p_collection text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) or not public.assetflow_can_write_company(p_company_id,p_collection) then raise exception 'Not allowed'; end if;
  case p_collection
    when 'users' then insert into app_users(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'departments' then insert into departments(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'locations' then insert into locations(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'vendors' then insert into vendors(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'asset-categories' then insert into asset_categories(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'assets' then insert into assets(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'invoices' then
      insert into invoices(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
      delete from invoice_line_items where company_id=p_company_id and invoice_id in(select x->>'id' from jsonb_array_elements(p_items)x);
      insert into invoice_line_items(company_id,id,invoice_id,data) select p_company_id,item->>'id',x->>'id',item from jsonb_array_elements(p_items)x cross join lateral jsonb_array_elements(coalesce(x->'lineItems','[]'::jsonb))item;
    when 'assignments' then insert into assignments(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'history' then insert into asset_history(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'call-logs' then insert into call_logs(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'licenses' then insert into software_licenses(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'audit-logs' then insert into audit_logs(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'kv' then insert into app_kv(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    else insert into master_data(company_id,collection,id,data) select p_company_id,p_collection,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,collection,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
  end case;
end $$;

create or replace function public.assetflow_delete_company_records(p_company_id uuid,p_collection text,p_ids text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) or not public.assetflow_can_write_company(p_company_id,p_collection) then raise exception 'Not allowed'; end if;
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

grant execute on function public.assetflow_company_context() to authenticated;
grant execute on function public.assetflow_save_company(jsonb) to authenticated;
grant execute on function public.assetflow_read_company_records(uuid) to authenticated;
grant execute on function public.assetflow_upsert_company_records(uuid,text,jsonb) to authenticated;
grant execute on function public.assetflow_delete_company_records(uuid,text,text[]) to authenticated;
revoke all on public.workspaces,public.companies,public.workspace_members,public.company_members from anon,authenticated;
