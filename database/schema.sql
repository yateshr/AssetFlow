-- Production database blueprint for AssetFlow.
-- Use separate tables in one secured application database, not separate databases
-- per module. This keeps reporting, linking, permissions, and backups manageable.

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  type text not null check (type in ('office', 'warehouse', 'remote')),
  capacity integer not null default 0,
  manager_name text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text not null unique,
  phone text,
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  join_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  website text,
  category text,
  contract_expiry date,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  manufacturer text,
  model text,
  serial_number text not null unique,
  asset_tag text not null unique,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance', 'retired')),
  purchase_date date,
  purchase_price numeric(12, 2) default 0,
  warranty_expiry date,
  location_id uuid references locations(id),
  assigned_to_user_id uuid references users(id),
  vendor_id uuid references vendors(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  user_id uuid not null references users(id),
  assigned_date date not null default current_date,
  return_date date,
  status text not null default 'active' check (status in ('active', 'returned', 'pending')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists it_call_logs (
  id uuid primary key default gen_random_uuid(),
  call_date date not null default current_date,
  call_time time not null default current_time,
  caller_user_id uuid references users(id),
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  contact_number text,
  category text not null check (category in ('hardware', 'software', 'network', 'access', 'asset-request', 'other')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  issue text not null,
  asset_id uuid references assets(id),
  assigned_to_user_id uuid references users(id),
  status text not null default 'open' check (status in ('open', 'in-progress', 'resolved', 'closed')),
  resolution text,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_department_id on users(department_id);
create index if not exists idx_users_location_id on users(location_id);
create index if not exists idx_assets_location_id on assets(location_id);
create index if not exists idx_assets_assigned_to_user_id on assets(assigned_to_user_id);
create index if not exists idx_it_call_logs_call_date on it_call_logs(call_date);
create index if not exists idx_it_call_logs_status on it_call_logs(status);


-- Asset lifecycle / history extension
-- Run after the existing schema. These statements are intentionally additive.

alter table users
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_status_check'
  ) then
    alter table users
      add constraint users_status_check
      check (status in ('active', 'inactive', 'left'));
  end if;
end $$;

-- Replace the existing asset status constraint with the lifecycle statuses.
alter table assets drop constraint if exists assets_status_check;
alter table assets
  add constraint assets_status_check
  check (status in ('available', 'assigned', 'maintenance', 'retired', 'disposed', 'lost'));

create table if not exists asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  action text not null,
  occurred_at timestamptz not null default now(),
  performed_by_user_id uuid references users(id) on delete set null,
  from_user_id uuid references users(id) on delete set null,
  to_user_id uuid references users(id) on delete set null,
  from_status text,
  to_status text,
  location_id uuid references locations(id) on delete set null,
  reason text,
  notes text,
  cost numeric(12, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_history_asset_time
  on asset_history(asset_id, occurred_at desc);

create index if not exists idx_asset_history_user
  on asset_history(from_user_id, to_user_id);

-- Add RLS policies here if your application uses Supabase/client-side database access.
-- The frontend in this package currently keeps state in React, so RLS is not enabled here.


-- Vendor invoice / procurement extension
-- Additive migration for vendor invoices and invoice line items.

alter table assets
  add column if not exists vendor_id uuid references vendors(id) on delete set null;

alter table assets
  add column if not exists invoice_id uuid;

create table if not exists vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete restrict,
  invoice_number text not null,
  invoice_date date not null,
  due_date date,
  currency text not null default 'USD',
  payment_terms text,
  po_number text,
  status text not null default 'draft'
    check (status in ('draft', 'received', 'partially-received', 'paid', 'partially-paid', 'overdue', 'cancelled')),
  notes text,
  subtotal numeric(12, 2) not null default 0,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  payment_date date,
  payment_reference text,
  payment_method text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (vendor_id, invoice_number)
);

create table if not exists vendor_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references vendor_invoices(id) on delete cascade,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  asset_type text,
  manufacturer text,
  model text,
  received_quantity integer not null default 0 check (received_quantity >= 0 and received_quantity <= quantity)
);

alter table assets
  add column if not exists invoice_item_id uuid references vendor_invoice_items(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assets_invoice_id_fk'
  ) then
    alter table assets
      add constraint assets_invoice_id_fk
      foreign key (invoice_id) references vendor_invoices(id) on delete set null;
  end if;
end $$;

create index if not exists idx_vendor_invoices_vendor_id on vendor_invoices(vendor_id);
create index if not exists idx_vendor_invoices_invoice_date on vendor_invoices(invoice_date);
create index if not exists idx_vendor_invoices_status on vendor_invoices(status);
create index if not exists idx_vendor_invoice_items_invoice_id on vendor_invoice_items(invoice_id);
create index if not exists idx_assets_invoice_id on assets(invoice_id);
create index if not exists idx_assets_invoice_item_id on assets(invoice_item_id);
