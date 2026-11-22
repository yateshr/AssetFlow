-- Asset holders: who is responsible for an asset that is NOT assigned to an employee.
-- A holder is a named account per site, for example "IT Assets Manager - Somnath" (stock), a shared
-- device point, or a vacant desk. Holders are stored with the other reference records (collection
-- 'holders'). An unassigned asset points to its holder with the field heldBy.

-- The stock holder of a site: where new, unassigned assets are kept.
create or replace function public.assetflow_default_holder(p_company_id uuid, p_site_id text)
returns text language sql stable security definer set search_path=public as $$
  select m.id from master_data m
  where m.company_id=p_company_id and m.collection='holders'
    and m.data->>'siteId'=p_site_id and m.data->>'kind'='stock'
    and coalesce((m.data->>'active')::boolean,true)
  order by m.created_at limit 1
$$;
grant execute on function public.assetflow_default_holder(uuid,text) to authenticated;

-- New assets (from an invoice or an approved request) start with the site's stock holder.
do $$
declare f record; def text; patched integer:=0;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='assetflow_create_tagged_assets'
  loop
    def:=pg_get_functiondef(f.oid);
    if position('''assignedTo'',null,' in def)>0 and position('heldBy' in def)=0 then
      def:=replace(def,'''assignedTo'',null,','''assignedTo'',null,''heldBy'',public.assetflow_default_holder(p_company_id,p_site_id),');
      execute def;
      patched:=patched+1;
    end if;
  end loop;
  if patched<2 then raise exception 'Expected to patch 2 asset creation functions, patched %',patched; end if;
end $$;

-- Holders belong to the company's structure: only company-wide users manage them.
create or replace function public.assetflow_can_write_company(p_company_id uuid,p_collection text)
returns boolean language sql stable security definer set search_path=public as $$
  select (
    public.assetflow_is_workspace_admin()
    or exists(select 1 from company_members cm where cm.company_id=p_company_id and cm.auth_user_id=auth.uid()
      and (cm.role='admin' or (cm.role in ('manager','technician') and p_collection not in ('users','system-policies'))))
    or exists(select 1 from company_access_grants g where g.company_id=p_company_id and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')) and g.active
      and (g.role='admin' or (g.role in ('manager','technician') and p_collection not in ('users','system-policies'))))
  ) and (
    p_collection not in ('asset-categories','system-policies','currencies','units-of-measure','payment-methods','payment-terms',
      'asset-conditions','license-types','call-categories','call-priorities','support-teams','location-types','infrastructure-types','holders')
    or public.assetflow_has_all_sites(p_company_id)
  )
$$;
