-- Make the workspace-level role explicit while keeping existing installations valid.
-- Existing `admin` records remain accepted as legacy Super Admins; newly created
-- workspace administrators use `super_admin`.

create or replace function public.assetflow_is_workspace_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from workspace_members where auth_user_id=auth.uid() and role in ('owner','admin'))
  or exists(select 1 from app_users where email=lower(coalesce(auth.jwt()->>'email','')) and role in ('super_admin','admin') and status='active')
  or not exists(select 1 from app_users)
$$;

create or replace function public.app_is_bootstrap_admin(p_collection text,p_data jsonb)
returns boolean language sql stable security definer set search_path=public as $$
  select p_collection = 'users'
  and public.app_needs_setup()
  and p_data->>'role' in ('super_admin','admin')
  and lower(p_data->>'email')=lower(coalesce(auth.jwt()->>'email',''))
$$;
