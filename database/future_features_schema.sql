-- AssetFlow future-feature schema preparation.
-- This is intentionally separate from the current local demo schema.
-- Run only when you are ready to connect the local workflows to Supabase.

create table if not exists public.maintenance_records (
  id text primary key,
  asset_id text not null,
  asset_name text not null,
  date date not null default current_date,
  type text not null check (type in ('preventive','repair','upgrade')),
  description text not null,
  cost numeric(12,2) not null default 0,
  technician text not null,
  status text not null check (status in ('completed','in-progress','scheduled')),
  created_at timestamptz not null default now()
);

create table if not exists public.asset_requests (
  id text primary key,
  user_id text not null,
  asset_type text not null,
  reason text not null,
  request_date date not null default current_date,
  status text not null check (status in ('pending','approved','rejected','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text,
  title text not null,
  detail text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_depreciation (
  asset_id text primary key,
  method text not null default 'straight-line',
  useful_life_years numeric(6,2) not null default 4,
  salvage_value numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_asset_idx on public.maintenance_records(asset_id);
create index if not exists asset_requests_user_idx on public.asset_requests(user_id);
create index if not exists notifications_user_idx on public.notifications(user_id);
