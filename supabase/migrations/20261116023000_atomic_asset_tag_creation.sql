-- Allocation and inserts share one transaction, so failed saves do not consume tags.
create or replace function public.assetflow_create_tagged_assets(p_company_id uuid,p_site_id text,p_type_code text,p_assets jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r asset_tag_site_series%rowtype; item jsonb; v_data jsonb; v_tag text; v_result jsonb:='[]'::jsonb; v_count integer; n integer; v_serial text;
begin
  v_count:=jsonb_array_length(coalesce(p_assets,'[]'::jsonb));
  if v_count < 1 or v_count > 100 then raise exception 'Create between 1 and 100 assets at a time'; end if;
  if not assetflow_can_write_company(p_company_id,'assets') or not assetflow_site_allowed(p_company_id,p_site_id) then raise exception 'You can only create assets for your assigned Site'; end if;
  select * into r from asset_tag_site_series where company_id=p_company_id and site_id=p_site_id and active for update;
  if not found then raise exception 'No active Site Series is configured for this Site'; end if;
  if trim(coalesce(p_type_code,''))='' then raise exception 'Asset type code is required'; end if;
  if exists(select 1 from jsonb_array_elements(p_assets) x group by lower(trim(x->>'serialNumber')) having count(*)>1) then raise exception 'Serial numbers must be unique within a batch'; end if;
  for item,n in select value, ordinality::integer from jsonb_array_elements(p_assets) with ordinality loop
    if coalesce(item->>'id','')='' then raise exception 'Each asset requires an ID'; end if;
    v_serial:=lower(trim(coalesce(item->>'serialNumber','')));
    if v_serial='' then raise exception 'Serial number is required for every asset'; end if;
    if exists(select 1 from assets where company_id=p_company_id and lower(trim(data->>'serialNumber'))=v_serial) then raise exception 'Serial number % already exists',item->>'serialNumber'; end if;
    v_tag:=concat_ws('-',r.company_prefix,r.function_prefix,upper(trim(p_type_code)),r.series||lpad((r.next_number+n-1)::text,r.digits,'0'));
    v_data:=item||jsonb_build_object('assetTag',v_tag,'siteId',p_site_id,'assignedTo',null,'status','available');
    insert into assets(company_id,id,data) values(p_company_id,v_data->>'id',v_data);
    v_result:=v_result||jsonb_build_array(v_data);
  end loop;
  update asset_tag_site_series set next_number=r.next_number+v_count where id=r.id;
  return v_result;
end $$;
grant execute on function public.assetflow_create_tagged_assets(uuid,text,text,jsonb) to authenticated;
