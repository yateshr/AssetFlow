-- AssetFlow relational storage, compatibility API, and legacy-data migration.
-- The portal continues to use collection names while PostgreSQL stores each
-- business domain in its own table. The old public.records table is retained
-- read-only as rollback evidence until a later migration removes it.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'AssetFlow Organization',
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'AssetFlow Organization')
on conflict (id) do nothing;

create or replace function public.assetflow_default_org_id()
returns uuid language sql stable as $$
  select id from public.organizations order by created_at limit 1
$$;

-- Every domain table has a database UUID (`row_id`), the existing portal ID
-- (`id`), organization ownership, typed/indexed business columns, and a JSON
-- compatibility payload for fields not yet promoted to first-class columns.
create table if not exists public.app_users (
  row_id uuid not null default gen_random_uuid() unique,
  organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key,
  data jsonb not null,
  email text generated always as (lower(data->>'email')) stored,
  display_name text generated always as (data->>'name') stored,
  role text generated always as (data->>'role') stored,
  status text generated always as (coalesce(data->>'status','active')) stored,
  department text generated always as (data->>'department') stored,
  location_id text generated always as (data->>'locationId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create unique index if not exists app_users_org_email_uq on public.app_users(organization_id,email);

create table if not exists public.departments (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, name text generated always as (data->>'name') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create unique index if not exists departments_org_name_uq on public.departments(organization_id,lower(name));

create table if not exists public.locations (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, name text generated always as (data->>'name') stored, location_type text generated always as (data->>'type') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create unique index if not exists locations_org_name_uq on public.locations(organization_id,lower(name));

create table if not exists public.vendors (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, name text generated always as (data->>'name') stored, email text generated always as (lower(data->>'email')) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create unique index if not exists vendors_org_name_uq on public.vendors(organization_id,lower(name));

create table if not exists public.asset_categories (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, name text generated always as (data->>'name') stored, code text generated always as (data->>'code') stored,
  active boolean generated always as (coalesce((data->>'active')::boolean,true)) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

create table if not exists public.assets (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null,
  asset_tag text generated always as (data->>'assetTag') stored, serial_number text generated always as (data->>'serialNumber') stored,
  name text generated always as (data->>'name') stored, category_id text generated always as (data->>'type') stored,
  status text generated always as (data->>'status') stored, vendor_id text generated always as (nullif(data->>'vendorId','')) stored,
  invoice_id text generated always as (nullif(data->>'invoiceId','')) stored, assigned_user_id text generated always as (nullif(data->>'assignedTo','')) stored,
  location_id text generated always as (nullif(data->>'location','')) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create unique index if not exists assets_org_tag_uq on public.assets(organization_id,lower(asset_tag)) where asset_tag is not null and asset_tag <> '';
create unique index if not exists assets_org_serial_uq on public.assets(organization_id,lower(serial_number)) where serial_number is not null and serial_number <> '';
create index if not exists assets_status_idx on public.assets(organization_id,status);

create table if not exists public.invoices (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, vendor_id text generated always as (data->>'vendorId') stored,
  invoice_number text generated always as (data->>'invoiceNumber') stored, invoice_date text generated always as (data->>'invoiceDate') stored,
  status text generated always as (data->>'status') stored, currency text generated always as (data->>'currency') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create index if not exists invoices_vendor_number_idx on public.invoices(organization_id,vendor_id,lower(invoice_number),invoice_date);

create table if not exists public.invoice_line_items (
  row_id uuid not null default gen_random_uuid() unique,
  organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, invoice_id text not null references public.invoices(id) on delete cascade,
  data jsonb not null, description text generated always as (data->>'description') stored,
  category_id text generated always as (data->>'assetType') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id);

create table if not exists public.assignments (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, asset_id text generated always as (data->>'assetId') stored,
  user_id text generated always as (data->>'userId') stored, status text generated always as (data->>'status') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

create table if not exists public.asset_history (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, asset_id text generated always as (data->>'assetId') stored,
  action text generated always as (data->>'action') stored, occurred_at text generated always as (data->>'timestamp') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
create index if not exists asset_history_asset_idx on public.asset_history(asset_id,occurred_at);

create table if not exists public.call_logs (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, call_date text generated always as (data->>'date') stored,
  caller_name text generated always as (data->>'callerName') stored, status text generated always as (data->>'status') stored,
  priority text generated always as (data->>'priority') stored, category text generated always as (data->>'category') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

create table if not exists public.software_licenses (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, name text generated always as (data->>'name') stored,
  license_type text generated always as (data->>'type') stored, expiry_date text generated always as (data->>'expiryDate') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

create table if not exists public.audit_logs (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, action text generated always as (data->>'action') stored,
  entity_type text generated always as (data->>'entityType') stored, occurred_at text generated always as (data->>'timestamp') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

create table if not exists public.master_data (
  row_id uuid not null default gen_random_uuid() unique, organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  collection text not null, id text not null, data jsonb not null,
  name text generated always as (data->>'name') stored, active boolean generated always as (coalesce((data->>'active')::boolean,true)) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid default auth.uid(),
  primary key(collection,id)
);

create table if not exists public.app_kv (
  organization_id uuid not null default public.assetflow_default_org_id() references public.organizations(id),
  id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);

-- Promote legacy records without deleting or modifying the source rows.
insert into public.app_users(id,data) select id,data from public.records where collection='users' on conflict(id) do update set data=excluded.data;
insert into public.departments(id,data) select id,data from public.records where collection='departments' on conflict(id) do update set data=excluded.data;
insert into public.locations(id,data) select id,data from public.records where collection='locations' on conflict(id) do update set data=excluded.data;
insert into public.vendors(id,data) select id,data from public.records where collection='vendors' on conflict(id) do update set data=excluded.data;
insert into public.asset_categories(id,data) select id,data from public.records where collection='asset-categories' on conflict(id) do update set data=excluded.data;
insert into public.assets(id,data) select id,data from public.records where collection='assets' on conflict(id) do update set data=excluded.data;
insert into public.invoices(id,data) select id,data from public.records where collection='invoices' on conflict(id) do update set data=excluded.data;
insert into public.assignments(id,data) select id,data from public.records where collection='assignments' on conflict(id) do update set data=excluded.data;
insert into public.asset_history(id,data) select id,data from public.records where collection='history' on conflict(id) do update set data=excluded.data;
insert into public.call_logs(id,data) select id,data from public.records where collection='call-logs' on conflict(id) do update set data=excluded.data;
insert into public.software_licenses(id,data) select id,data from public.records where collection='licenses' on conflict(id) do update set data=excluded.data;
insert into public.audit_logs(id,data) select id,data from public.records where collection='audit-logs' on conflict(id) do update set data=excluded.data;
insert into public.app_kv(id,data) select id,data from public.records where collection='kv' on conflict(id) do update set data=excluded.data;
insert into public.master_data(collection,id,data)
select collection,id,data from public.records where collection not in ('users','departments','locations','vendors','asset-categories','assets','invoices','assignments','history','call-logs','licenses','audit-logs','kv')
on conflict(collection,id) do update set data=excluded.data;

insert into public.invoice_line_items(id,invoice_id,data)
select item->>'id', invoice.id, item
from public.invoices invoice cross join lateral jsonb_array_elements(coalesce(invoice.data->'lineItems','[]'::jsonb)) item
where item->>'id' is not null
on conflict(id) do update set invoice_id=excluded.invoice_id,data=excluded.data;

-- Existing legacy rows are not rejected during migration, while every new or
-- changed relationship is checked by PostgreSQL from this point forward.
alter table public.assets add constraint assets_vendor_fk foreign key(vendor_id) references public.vendors(id) not valid;
alter table public.assets add constraint assets_invoice_fk foreign key(invoice_id) references public.invoices(id) not valid;
alter table public.assets add constraint assets_assigned_user_fk foreign key(assigned_user_id) references public.app_users(id) not valid;
alter table public.invoices add constraint invoices_vendor_fk foreign key(vendor_id) references public.vendors(id) not valid;
alter table public.assignments add constraint assignments_asset_fk foreign key(asset_id) references public.assets(id) not valid;
alter table public.assignments add constraint assignments_user_fk foreign key(user_id) references public.app_users(id) not valid;
alter table public.asset_history add constraint asset_history_asset_fk foreign key(asset_id) references public.assets(id) not valid;

create or replace function public.assetflow_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.app_users where email=lower(coalesce(auth.jwt()->>'email','')) and status='active' limit 1
$$;

create or replace function public.assetflow_can_write(p_collection text)
returns boolean language sql stable security definer set search_path=public as $$
  select case when public.assetflow_role() is null then false
    when p_collection='users' or p_collection like 'system-%' then public.assetflow_role()='admin'
    when p_collection in ('call-logs','history','audit-logs','kv') then true
    else public.assetflow_role() in ('admin','manager') end
$$;

create or replace function public.assetflow_read_records()
returns table(collection text,id text,data jsonb,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select 'users',id,data,created_at from app_users union all select 'departments',id,data,created_at from departments
  union all select 'locations',id,data,created_at from locations union all select 'vendors',id,data,created_at from vendors
  union all select 'asset-categories',id,data,created_at from asset_categories union all select 'assets',id,data,created_at from assets
  union all select 'invoices',id,data,created_at from invoices union all select 'assignments',id,data,created_at from assignments
  union all select 'history',id,data,created_at from asset_history union all select 'call-logs',id,data,created_at from call_logs
  union all select 'licenses',id,data,created_at from software_licenses union all select 'audit-logs',id,data,created_at from audit_logs
  union all select collection,id,data,created_at from master_data union all select 'kv',id,data,updated_at from app_kv
$$;

create or replace function public.assetflow_upsert_records(p_collection text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not (public.assetflow_can_write(p_collection) or (p_collection='users' and not exists(select 1 from app_users))) then raise exception 'Not allowed'; end if;
  case p_collection
    when 'users' then insert into app_users(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'departments' then insert into departments(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'locations' then insert into locations(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'vendors' then insert into vendors(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'asset-categories' then insert into asset_categories(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'assets' then insert into assets(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'invoices' then
      insert into invoices(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
      delete from invoice_line_items where invoice_id in(select x->>'id' from jsonb_array_elements(p_items)x);
      insert into invoice_line_items(id,invoice_id,data) select item->>'id',x->>'id',item from jsonb_array_elements(p_items)x cross join lateral jsonb_array_elements(coalesce(x->'lineItems','[]'::jsonb))item;
    when 'assignments' then insert into assignments(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'history' then insert into asset_history(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'call-logs' then insert into call_logs(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'licenses' then insert into software_licenses(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'audit-logs' then insert into audit_logs(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'kv' then insert into app_kv(id,data) select x->>'id',x from jsonb_array_elements(p_items)x on conflict(id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    else insert into master_data(collection,id,data) select p_collection,x->>'id',x from jsonb_array_elements(p_items)x on conflict(collection,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
  end case;
end $$;

create or replace function public.assetflow_delete_records(p_collection text,p_ids text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_write(p_collection) then raise exception 'Not allowed'; end if;
  case p_collection
    when 'users' then delete from app_users where id=any(p_ids); when 'departments' then delete from departments where id=any(p_ids);
    when 'locations' then delete from locations where id=any(p_ids); when 'vendors' then delete from vendors where id=any(p_ids);
    when 'asset-categories' then delete from asset_categories where id=any(p_ids); when 'assets' then delete from assets where id=any(p_ids);
    when 'invoices' then delete from invoices where id=any(p_ids); when 'assignments' then delete from assignments where id=any(p_ids);
    when 'history' then delete from asset_history where id=any(p_ids); when 'call-logs' then delete from call_logs where id=any(p_ids);
    when 'licenses' then delete from software_licenses where id=any(p_ids); when 'audit-logs' then delete from audit_logs where id=any(p_ids);
    when 'kv' then delete from app_kv where id=any(p_ids); else delete from master_data where collection=p_collection and id=any(p_ids);
  end case;
end $$;

grant execute on function public.assetflow_read_records() to authenticated;
grant execute on function public.assetflow_upsert_records(text,jsonb) to authenticated;
grant execute on function public.assetflow_delete_records(text,text[]) to authenticated;

-- Signup and first-admin helpers now use the relational users table.
create or replace function public.app_needs_setup() returns boolean language sql stable security definer set search_path=public as $$ select not exists(select 1 from app_users) $$;
create or replace function public.app_role() returns text language sql stable security definer set search_path=public as $$ select public.assetflow_role() $$;
create or replace function public.app_signup_allowed(p_email text) returns boolean language sql stable security definer set search_path=public as $$ select public.app_needs_setup() or exists(select 1 from app_users where email=lower(p_email)) $$;

-- Restrict direct table access; portal operations go through the validated RPCs.
revoke all on public.app_users,public.departments,public.locations,public.vendors,public.asset_categories,public.assets,public.invoices,public.invoice_line_items,public.assignments,public.asset_history,public.call_logs,public.software_licenses,public.audit_logs,public.master_data,public.app_kv from anon,authenticated;
