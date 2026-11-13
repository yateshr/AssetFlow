-- AssetFlow database schema
-- ---------------------------------------------------------------------------
-- One company = one Supabase project. There is no company-specific data here;
-- the first person to sign up becomes the administrator (see README.md).
--
-- Storage model: every business object (asset, user, vendor, invoice, ...) is a
-- JSON document in `records`, grouped by `collection`. This keeps the schema
-- stable while the app evolves. Access is enforced here with Row Level
-- Security, not in the browser.
-- ---------------------------------------------------------------------------

create table if not exists public.records (
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  updated_by uuid        default auth.uid(),
  primary key (collection, id),
  check (length(collection) between 1 and 64),
  check (length(id) between 1 and 200)
);

create index if not exists records_collection_idx on public.records (collection);
create index if not exists records_data_gin on public.records using gin (data jsonb_path_ops);

create or replace function public.records_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before update on public.records
  for each row execute function public.records_touch();

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can look at the users collection)
-- ---------------------------------------------------------------------------

-- True when nobody has been registered yet (fresh install).
create or replace function public.app_needs_setup()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.records where collection = 'users');
$$;

-- Role ('admin' | 'manager' | 'user') of the signed-in person, or NULL if they
-- are not an active registered user.
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select r.data->>'role'
  from public.records r
  where r.collection = 'users'
    and lower(r.data->>'email') = lower(coalesce(auth.jwt()->>'email', ''))
    and coalesce(r.data->>'status', 'active') = 'active'
  limit 1;
$$;

-- Used by the sign-up form to give a friendly message before creating an account.
create or replace function public.app_signup_allowed(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_needs_setup()
      or exists (
        select 1 from public.records r
        where r.collection = 'users' and lower(r.data->>'email') = lower(p_email)
      );
$$;

grant execute on function public.app_needs_setup() to anon, authenticated;
grant execute on function public.app_signup_allowed(text) to anon, authenticated;
grant execute on function public.app_role() to authenticated;

-- Only allow account creation for the very first user (the admin) or for an
-- e-mail address an administrator has already added on the Users page.
create or replace function public.app_guard_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.app_signup_allowed(new.email) then
    raise exception 'This e-mail address has not been added by an administrator.';
  end if;
  return new;
end $$;

drop trigger if exists app_guard_signup on auth.users;
create trigger app_guard_signup before insert on auth.users
  for each row execute function public.app_guard_signup();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.records enable row level security;

grant select, insert, update, delete on public.records to authenticated;

-- First-run bootstrap: on a fresh install the new account may register itself as
-- the administrator. (Used by both policies because the client upserts, and
-- Postgres evaluates the UPDATE policy for INSERT ... ON CONFLICT DO UPDATE.)
create or replace function public.app_is_bootstrap_admin(p_collection text, p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select p_collection = 'users'
     and public.app_needs_setup()
     and p_data->>'role' = 'admin'
     and lower(p_data->>'email') = lower(coalesce(auth.jwt()->>'email', ''));
$$;
grant execute on function public.app_is_bootstrap_admin(text, jsonb) to authenticated;
-- (The bootstrap clause lets the very first admin's upsert pass the SELECT check
-- Postgres applies to INSERT ... ON CONFLICT DO UPDATE; it matches only that row.)
drop policy if exists records_read on public.records;
create policy records_read on public.records
  for select to authenticated
  using (
    public.app_role() is not null
    or public.app_is_bootstrap_admin(collection, data)
  );

-- Who may change what:
--   users, config  -> admins only (plus creating the very first admin)
--   call-logs, kv, history, audit-logs -> every active user
--   everything else -> admins and managers
create or replace function public.app_can_write(p_collection text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.app_role() is null then false
    when p_collection in ('users', 'config') then public.app_role() = 'admin'
    when p_collection in ('call-logs', 'kv', 'history', 'audit-logs') then true
    else public.app_role() in ('admin', 'manager')
  end;
$$;
grant execute on function public.app_can_write(text) to authenticated;

drop policy if exists records_insert on public.records;
create policy records_insert on public.records
  for insert to authenticated
  with check (
    public.app_can_write(collection)
    or public.app_is_bootstrap_admin(collection, data)
  );

drop policy if exists records_update on public.records;
create policy records_update on public.records
  for update to authenticated
  using (public.app_can_write(collection))
  with check (
    public.app_can_write(collection)
    or public.app_is_bootstrap_admin(collection, data)
  );

drop policy if exists records_delete on public.records;
create policy records_delete on public.records
  for delete to authenticated
  using (public.app_can_write(collection));
