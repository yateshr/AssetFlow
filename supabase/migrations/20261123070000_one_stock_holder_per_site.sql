-- Each site has exactly one IT Assets Manager (its stock holder). The database refuses a second
-- active stock holder for the same site; other holders (shared devices, vacant desks) are unlimited.
do $$
begin
  if exists(
    select 1 from public.master_data
    where collection='holders' and data->>'kind'='stock' and coalesce((data->>'active')::boolean,true)
    group by company_id, data->>'siteId' having count(*)>1
  ) then
    raise exception 'A site has more than one active stock holder. Archive the extra ones, then apply this migration again.';
  end if;
end $$;

create unique index if not exists master_data_one_stock_holder_per_site
  on public.master_data (company_id, (data->>'siteId'))
  where collection='holders' and data->>'kind'='stock' and coalesce((data->>'active')::boolean,true);
