-- A department name only has to be unique within a site: DISPATCH may exist at Somnath and at Angam Unit 1.
-- The old index allowed one DISPATCH per company, so a second site could not get its own departments.
drop index if exists public.departments_company_name_uq;
drop index if exists public.departments_company_site_name_uq;
create unique index departments_company_site_name_uq on public.departments(company_id, coalesce(data->>'siteId',''), lower(name));
