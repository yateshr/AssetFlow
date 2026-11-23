-- E-mail is optional for employees. The unique index used to forbid two blank addresses, which is why imports
-- invented addresses like 1103001007@import.local. Blank addresses may now repeat; real addresses stay unique.
drop index if exists public.app_users_company_email_uq;
create unique index app_users_company_email_uq on public.app_users(company_id,email) where coalesce(email,'')<>'';

-- Clear the addresses that earlier imports made up.
do $$
begin
  alter table public.app_users disable trigger users_site_scope;
  update public.app_users set data=jsonb_set(data,'{email}','""'::jsonb) where data->>'email' ilike '%@import.local';
  alter table public.app_users enable trigger users_site_scope;
end $$;
