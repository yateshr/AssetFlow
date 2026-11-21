set local session_replication_role = replica;
update public.assets set data=data||jsonb_build_object('siteId',data->>'location') where data ? 'location';
set local session_replication_role = origin;

create or replace function public.assetflow_sync_legacy_site_key()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='assets' then
    if new.data ? 'siteId' then new.data:=new.data||jsonb_build_object('location',new.data->>'siteId');
    elsif new.data ? 'location' then new.data:=new.data||jsonb_build_object('siteId',new.data->>'location'); end if;
  elsif new.data ? 'siteId' then
    new.data:=new.data||jsonb_build_object('locationId',new.data->>'siteId');
  end if;
  return new;
end $$;

drop trigger if exists aa_sync_site_key_assets on public.assets;
create trigger aa_sync_site_key_assets before insert or update on public.assets for each row execute function public.assetflow_sync_legacy_site_key();

create or replace function public.assetflow_upsert_company_records(p_company_id uuid,p_collection text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.assetflow_can_access_company(p_company_id) or not public.assetflow_can_write_company(p_company_id,p_collection) then raise exception 'Not allowed'; end if;
  if p_collection='assets' and exists(select 1 from jsonb_array_elements(p_items) x where not public.assetflow_site_allowed(p_company_id,coalesce(x->>'siteId',x->>'location',''))) then raise exception 'You can only save assets for your assigned site'; end if;
  if p_collection='invoices' and exists(select 1 from jsonb_array_elements(p_items) x where not public.assetflow_site_allowed(p_company_id,coalesce(x->>'siteId',x->>'locationId',''))) then raise exception 'You can only save invoices for your assigned site'; end if;
  case p_collection
    when 'users' then insert into app_users(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'departments' then insert into departments(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'locations' then insert into locations(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'vendors' then insert into vendors(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'asset-categories' then insert into asset_categories(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'assets' then insert into assets(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'invoices' then insert into invoices(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid(); delete from invoice_line_items where company_id=p_company_id and invoice_id in(select x->>'id' from jsonb_array_elements(p_items)x); insert into invoice_line_items(company_id,id,invoice_id,data) select p_company_id,item->>'id',x->>'id',item from jsonb_array_elements(p_items)x cross join lateral jsonb_array_elements(coalesce(x->'lineItems','[]'::jsonb))item;
    when 'assignments' then insert into assignments(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'history' then insert into asset_history(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'call-logs' then insert into call_logs(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'licenses' then insert into software_licenses(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'audit-logs' then insert into audit_logs(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    when 'kv' then insert into app_kv(company_id,id,data) select p_company_id,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
    else insert into master_data(company_id,collection,id,data) select p_company_id,p_collection,x->>'id',x from jsonb_array_elements(p_items)x on conflict(company_id,collection,id)do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
  end case;
end $$;

grant execute on function public.assetflow_upsert_company_records(uuid,text,jsonb) to authenticated;
