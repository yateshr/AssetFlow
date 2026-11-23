-- One holder per site: the IT Assets Manager holds everything at the site that is not given to an employee.
-- Whether an item is in the store or installed somewhere is now its status (available / deployed) and
-- its "Where" (deployedAt), so the extra holder kinds (shared places, vacant desks) are retired:
--   * assets held by a shared place become status 'deployed' with deployedAt = that place's name;
--   * assets held by a vacant desk go back to the store (stay 'available');
--   * both are now held by the site's IT Assets Manager, which is created when a site has none.
do $$
declare r record;
begin
  alter table public.assets disable trigger assets_site_scope;

  for r in
    select distinct h.company_id, h.data->>'siteId' as site_id
    from public.master_data h
    where h.collection='holders' and h.data->>'kind' in ('shared','vacant')
      and not exists (
        select 1 from public.master_data s
        where s.company_id=h.company_id and s.collection='holders' and s.data->>'kind'='stock'
          and s.data->>'siteId'=h.data->>'siteId' and coalesce((s.data->>'active')::boolean,true))
  loop
    insert into public.master_data(company_id,collection,id,data)
    values (r.company_id,'holders','HLD-STOCK-'||r.site_id,
      jsonb_build_object('id','HLD-STOCK-'||r.site_id,'siteId',r.site_id,'kind','stock',
        'name','IT Assets Manager – '||coalesce((select l.data->>'name' from public.locations l where l.company_id=r.company_id and l.id=r.site_id), r.site_id),
        'active',true))
    on conflict do nothing;
  end loop;

  update public.assets a
  set data = a.data
    || jsonb_build_object('heldBy', s.id)
    || case when h.data->>'kind'='shared' and a.data->>'status'='available'
            then jsonb_build_object('status','deployed','deployedAt',h.data->>'name')
            else '{}'::jsonb end
  from public.master_data h
  join public.master_data s on s.company_id=h.company_id and s.collection='holders' and s.data->>'kind'='stock'
    and s.data->>'siteId'=h.data->>'siteId' and coalesce((s.data->>'active')::boolean,true)
  where h.collection='holders' and h.data->>'kind' in ('shared','vacant')
    and a.company_id=h.company_id and a.data->>'heldBy'=h.id and a.data->>'status' is distinct from 'assigned';

  delete from public.master_data where collection='holders' and data->>'kind' in ('shared','vacant');

  alter table public.assets enable trigger assets_site_scope;
end $$;
