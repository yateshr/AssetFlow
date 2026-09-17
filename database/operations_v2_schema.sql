-- AssetFlow operations v2 schema preparation.
-- Local-first release: run later when Supabase persistence is enabled.

create table if not exists public.it_stock_items (
  id text primary key,
  name text not null,
  sku text not null unique,
  category text not null default 'General',
  quantity integer not null default 0 check (quantity >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0),
  unit_cost numeric(12,2) not null default 0,
  location text not null default 'IT Store',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.it_stock_movements (
  id text primary key,
  stock_id text not null references public.it_stock_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('received','issued','returned','adjusted')),
  quantity integer not null check (quantity > 0),
  quantity_before integer not null,
  quantity_after integer not null,
  reason text,
  performed_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.device_specs (
  asset_id text primary key,
  enabled boolean not null default false,
  hostname text,
  operating_system text,
  os_version text,
  cpu text,
  ram text,
  storage text,
  gpu text,
  mac_address text,
  ip_address text,
  bios_version text,
  encryption boolean not null default false,
  antivirus boolean not null default false,
  edr boolean not null default false,
  last_check_in timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.infrastructure_assets (
  id text primary key,
  name text not null,
  type text not null check (type in ('server','router','switch','firewall','access-point','ups','printer','other')),
  ip_address text,
  mac_address text,
  hostname text,
  location text,
  status text not null default 'online' check (status in ('online','offline','maintenance')),
  vendor text,
  model text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_stock_id on public.it_stock_movements(stock_id);
create index if not exists idx_stock_movements_created_at on public.it_stock_movements(created_at desc);
create index if not exists idx_infrastructure_status on public.infrastructure_assets(status);
