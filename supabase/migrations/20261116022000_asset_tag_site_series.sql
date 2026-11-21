-- Each issuing Site owns one shared sequence.  The asset type only changes the
-- middle code (for example NP-IT-KBD-B0292), never the Site counter.
create table if not exists public.asset_tag_site_series (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id text not null,
  company_prefix text not null default 'NP',
  function_prefix text not null default 'IT',
  series text not null,
  next_number integer not null check (next_number > 0),
  digits integer not null default 4 check (digits between 1 and 8),
  active boolean not null default true,
  unique (company_id, site_id),
  foreign key (company_id, site_id) references public.locations(company_id, id) on delete restrict
);

alter table public.asset_tag_site_series enable row level security;

create or replace function public.assetflow_list_asset_tag_site_series(p_company_id uuid)
returns table(id uuid, site_id text, company_prefix text, function_prefix text, series text, next_number integer, digits integer, active boolean)
language sql security definer set search_path=public as $$
  select r.id,r.site_id,r.company_prefix,r.function_prefix,r.series,r.next_number,r.digits,r.active
  from asset_tag_site_series r
  where r.company_id=p_company_id and assetflow_can_access_company(p_company_id)
  order by r.series, r.site_id;
$$;

create or replace function public.assetflow_save_asset_tag_site_series(p_company_id uuid, p_rule jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=nullif(p_rule->>'id','')::uuid; v_site text:=trim(p_rule->>'siteId');
begin
  if not assetflow_is_workspace_admin() then raise exception 'Only the Super Admin can configure Site Series'; end if;
  if not assetflow_can_access_company(p_company_id) then raise exception 'Not allowed'; end if;
  if v_site='' or not exists(select 1 from locations where company_id=p_company_id and id=v_site) then raise exception 'Select a valid Site'; end if;
  insert into asset_tag_site_series(id,company_id,site_id,company_prefix,function_prefix,series,next_number,digits,active)
  values(coalesce(v_id,gen_random_uuid()),p_company_id,v_site,upper(trim(coalesce(p_rule->>'companyPrefix',''))),upper(trim(coalesce(p_rule->>'functionPrefix',''))),upper(trim(coalesce(p_rule->>'series',''))),greatest(1,coalesce((p_rule->>'nextNumber')::integer,1)),greatest(1,least(8,coalesce((p_rule->>'digits')::integer,4))),coalesce((p_rule->>'active')::boolean,true))
  on conflict(company_id,site_id) do update set company_prefix=excluded.company_prefix,function_prefix=excluded.function_prefix,series=excluded.series,next_number=excluded.next_number,digits=excluded.digits,active=excluded.active
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.assetflow_reserve_asset_tags(p_company_id uuid,p_site_id text,p_type_code text,p_quantity integer)
returns table(asset_tag text, sequence_number integer)
language plpgsql security definer set search_path=public as $$
declare r asset_tag_site_series%rowtype; n integer;
begin
  if p_quantity < 1 or p_quantity > 100 then raise exception 'Quantity must be between 1 and 100'; end if;
  if not assetflow_can_write_company(p_company_id,'assets') or not assetflow_site_allowed(p_company_id,p_site_id) then raise exception 'You can only create assets for your assigned Site'; end if;
  select * into r from asset_tag_site_series where company_id=p_company_id and site_id=p_site_id and active for update;
  if not found then raise exception 'No active Site Series is configured for this Site'; end if;
  if trim(coalesce(p_type_code,''))='' then raise exception 'Asset type code is required'; end if;
  for n in r.next_number..r.next_number+p_quantity-1 loop
    asset_tag:=concat_ws('-',r.company_prefix,r.function_prefix,upper(trim(p_type_code)),r.series||lpad(n::text,r.digits,'0'));
    sequence_number:=n; return next;
  end loop;
  update asset_tag_site_series set next_number=r.next_number+p_quantity where id=r.id;
end $$;

grant execute on function public.assetflow_list_asset_tag_site_series(uuid) to authenticated;
grant execute on function public.assetflow_save_asset_tag_site_series(uuid,jsonb) to authenticated;
grant execute on function public.assetflow_reserve_asset_tags(uuid,text,text,integer) to authenticated;
