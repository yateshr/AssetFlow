-- Company-wide asset tag format: the character between the tag parts, and whether the
-- function prefix (the IT in NP-IT-CPU-B0288) is part of the tag at all.
-- Existing assets keep their tags; only tags issued from now on use the new format.

alter table public.asset_tag_site_series
  add column if not exists separator text not null default '-',
  add column if not exists use_function_prefix boolean not null default true;

alter table public.asset_tag_site_series drop constraint if exists asset_tag_separator_allowed;
alter table public.asset_tag_site_series
  add constraint asset_tag_separator_allowed check (separator in ('-','.','_','/',''));

-- One place that decides how a tag is written. Empty or missing parts are skipped.
create or replace function public.assetflow_join_tag(p_separator text, p_company text, p_function text, p_type text, p_serial text)
returns text language sql immutable as $$
  select array_to_string(array(select x from unnest(array[p_company,p_function,p_type,p_serial]) as x where coalesce(x,'')<>''), coalesce(p_separator,'-'));
$$;

-- The three tag-issuing functions build the tag with concat_ws('-', ...). Re-create each of them
-- (whatever its current definition) so it uses the company's separator and function-prefix setting.
do $$
declare f record; def text; patched integer:=0;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('assetflow_reserve_asset_tags','assetflow_create_tagged_assets')
  loop
    def:=pg_get_functiondef(f.oid);
    if position('concat_ws(''-'',r.company_prefix,r.function_prefix,' in def)>0 then
      def:=replace(def,'concat_ws(''-'',r.company_prefix,r.function_prefix,','assetflow_join_tag(r.separator,r.company_prefix,case when r.use_function_prefix then r.function_prefix end,');
      execute def;
      patched:=patched+1;
    end if;
  end loop;
  if patched<3 then raise exception 'Expected to patch 3 tag functions, patched %',patched; end if;
end $$;

drop function if exists public.assetflow_list_asset_tag_site_series(uuid);
create function public.assetflow_list_asset_tag_site_series(p_company_id uuid)
returns table(id uuid, site_id text, company_prefix text, function_prefix text, series text, next_number integer, digits integer, active boolean, separator text, use_function_prefix boolean)
language sql security definer set search_path=public as $$
  select r.id,r.site_id,r.company_prefix,r.function_prefix,r.series,r.next_number,r.digits,r.active,r.separator,r.use_function_prefix
  from asset_tag_site_series r
  where r.company_id=p_company_id and assetflow_can_access_company(p_company_id)
  order by r.series, r.site_id;
$$;
grant execute on function public.assetflow_list_asset_tag_site_series(uuid) to authenticated;

create or replace function public.assetflow_save_asset_tag_site_series(p_company_id uuid, p_rule jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_id uuid:=nullif(p_rule->>'id','')::uuid; v_site text:=trim(p_rule->>'siteId');
  v_sep text; v_use boolean;
begin
  if not assetflow_is_workspace_admin() then raise exception 'Only the Super Admin can configure Site Series'; end if;
  if not assetflow_can_access_company(p_company_id) then raise exception 'Not allowed'; end if;
  if v_site='' or not exists(select 1 from locations where company_id=p_company_id and id=v_site) then raise exception 'Select a valid Site'; end if;
  -- The format is company-wide: a rule saved without one takes the company's current format.
  select r.separator, r.use_function_prefix into v_sep, v_use from asset_tag_site_series r where r.company_id=p_company_id order by r.series limit 1;
  v_sep:=coalesce(p_rule->>'separator', v_sep, '-');
  v_use:=coalesce((p_rule->>'useFunctionPrefix')::boolean, v_use, true);
  if v_sep not in ('-','.','_','/','') then raise exception 'Unsupported separator'; end if;
  insert into asset_tag_site_series(id,company_id,site_id,company_prefix,function_prefix,series,next_number,digits,active,separator,use_function_prefix)
  values(coalesce(v_id,gen_random_uuid()),p_company_id,v_site,upper(trim(coalesce(p_rule->>'companyPrefix',''))),upper(trim(coalesce(p_rule->>'functionPrefix',''))),upper(trim(coalesce(p_rule->>'series',''))),greatest(1,coalesce((p_rule->>'nextNumber')::integer,1)),greatest(1,least(8,coalesce((p_rule->>'digits')::integer,4))),coalesce((p_rule->>'active')::boolean,true),v_sep,v_use)
  on conflict(company_id,site_id) do update set company_prefix=excluded.company_prefix,function_prefix=excluded.function_prefix,series=excluded.series,next_number=excluded.next_number,digits=excluded.digits,active=excluded.active,separator=excluded.separator,use_function_prefix=excluded.use_function_prefix
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.assetflow_save_asset_tag_site_series(uuid,jsonb) to authenticated;

-- Changes the format for every site of the company in one step.
create or replace function public.assetflow_set_asset_tag_format(p_company_id uuid, p_separator text, p_use_function_prefix boolean)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not assetflow_is_workspace_admin() then raise exception 'Only the Super Admin can configure the tag format'; end if;
  if not assetflow_can_access_company(p_company_id) then raise exception 'Not allowed'; end if;
  if p_separator not in ('-','.','_','/','') then raise exception 'Unsupported separator'; end if;
  update asset_tag_site_series set separator=p_separator, use_function_prefix=coalesce(p_use_function_prefix,true) where company_id=p_company_id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.assetflow_set_asset_tag_format(uuid,text,boolean) to authenticated;
