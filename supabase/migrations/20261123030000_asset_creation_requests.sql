-- A site IT admin may only create assets from an invoice. When they need an asset without one
-- (a gift, a replacement, an old device found), they ask the Super Admin, who approves or rejects it.
-- On approval the assets are created in one step with proper tags, and a history entry is written.

create table if not exists public.asset_creation_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id text not null,
  asset_type text not null,
  items jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid default auth.uid(),
  requested_by_email text default lower(coalesce(auth.jwt()->>'email','')),
  requested_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_asset_ids jsonb,
  foreign key (company_id, site_id) references public.locations(company_id, id) on delete restrict
);
alter table public.asset_creation_requests enable row level security;
revoke all on public.asset_creation_requests from anon, authenticated;
create index if not exists asset_creation_requests_company_status on public.asset_creation_requests(company_id, status, requested_at desc);

-- ---------------------------------------------------------------- ask
create or replace function public.assetflow_request_asset_creation(p_company_id uuid, p_request jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_site text:=trim(coalesce(p_request->>'siteId','')); v_type text:=trim(coalesce(p_request->>'assetType',''));
        v_reason text:=trim(coalesce(p_request->>'reason','')); v_items jsonb:=coalesce(p_request->'items','[]'::jsonb); v_count integer;
begin
  if not assetflow_can_access_company(p_company_id) or not assetflow_can_write_company(p_company_id,'assets') then raise exception 'Not allowed'; end if;
  if not assetflow_site_allowed(p_company_id,v_site) then raise exception 'You can only request assets for your assigned site'; end if;
  if not exists(select 1 from locations where company_id=p_company_id and id=v_site) then raise exception 'Select a valid site'; end if;
  if v_type='' or not exists(select 1 from asset_categories where company_id=p_company_id and id=v_type) then raise exception 'Select a valid asset type'; end if;
  if length(v_reason)<5 then raise exception 'Please explain why the asset is needed without an invoice'; end if;
  v_count:=jsonb_array_length(v_items);
  if v_count<1 or v_count>100 then raise exception 'Request between 1 and 100 items'; end if;
  if exists(select 1 from jsonb_array_elements(v_items) x where trim(coalesce(x->>'serialNumber',''))='' or trim(coalesce(x->>'name',''))='') then raise exception 'Every item needs a name and a serial number'; end if;
  if exists(select 1 from jsonb_array_elements(v_items) x group by lower(trim(x->>'serialNumber')) having count(*)>1) then raise exception 'Serial numbers must be unique within the request'; end if;
  insert into asset_creation_requests(company_id,site_id,asset_type,items,reason) values(p_company_id,v_site,v_type,v_items,v_reason) returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- see
-- The Super Admin sees every request of the company; a site IT admin sees the requests of their own site.
create or replace function public.assetflow_list_asset_creation_requests(p_company_id uuid)
returns table(id uuid, site_id text, asset_type text, items jsonb, reason text, status text, requested_by_email text, requested_at timestamptz, decided_at timestamptz, decision_note text, created_asset_ids jsonb)
language sql stable security definer set search_path=public as $$
  select r.id,r.site_id,r.asset_type,r.items,r.reason,r.status,r.requested_by_email,r.requested_at,r.decided_at,r.decision_note,r.created_asset_ids
  from asset_creation_requests r
  where r.company_id=p_company_id and assetflow_can_access_company(p_company_id) and assetflow_site_allowed(p_company_id,r.site_id)
  order by (r.status='pending') desc, r.requested_at desc
$$;

-- ---------------------------------------------------------------- decide (Super Admin only)
create or replace function public.assetflow_decide_asset_creation(p_request_id uuid, p_approve boolean, p_note text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare r asset_creation_requests%rowtype; v_code text; v_assets jsonb; v_created jsonb; v_ids jsonb:='[]'::jsonb; a jsonb;
begin
  if not assetflow_is_workspace_admin() then raise exception 'Only the Super Admin can decide asset requests'; end if;
  select * into r from asset_creation_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status<>'pending' then raise exception 'This request was already %',r.status; end if;
  if not p_approve then
    update asset_creation_requests set status='rejected',decided_by=auth.uid(),decided_at=now(),decision_note=trim(coalesce(p_note,'')) where id=r.id;
    return '[]'::jsonb;
  end if;
  select coalesce(nullif(trim(data->>'code'),''),data->>'name') into v_code from asset_categories where company_id=r.company_id and id=r.asset_type;
  if coalesce(v_code,'')='' then raise exception 'The asset type no longer exists'; end if;
  select jsonb_agg(x || jsonb_build_object(
      'id','AST-'||upper(substr(md5(random()::text||clock_timestamp()::text||ord::text),1,10))||'R',
      'type',r.asset_type,'notes',coalesce(nullif(x->>'notes',''),'Created from an approved request: '||r.reason)))
    into v_assets from jsonb_array_elements(r.items) with ordinality t(x,ord);
  v_created:=assetflow_create_tagged_assets(p_company_id=>r.company_id,p_site_id=>r.site_id,p_type_code=>v_code,p_assets=>v_assets,p_invoice_id=>null,p_invoice_item_id=>null);
  for a in select * from jsonb_array_elements(v_created) loop
    v_ids:=v_ids||jsonb_build_array(a->>'id');
    insert into asset_history(company_id,id,data) values(r.company_id,'H-'||(a->>'id')||'-REQ',jsonb_build_object(
      'id','H-'||(a->>'id')||'-REQ','assetId',a->>'id','timestamp',now(),'action','Purchased','siteId',r.site_id,
      'reason','Approved asset request','notes',r.reason,'source','asset-request','entityType','Asset'));
  end loop;
  update asset_creation_requests set status='approved',decided_by=auth.uid(),decided_at=now(),decision_note=trim(coalesce(p_note,'')),created_asset_ids=v_ids where id=r.id;
  return v_created;
end $$;

grant execute on function public.assetflow_request_asset_creation(uuid,jsonb) to authenticated;
grant execute on function public.assetflow_list_asset_creation_requests(uuid) to authenticated;
grant execute on function public.assetflow_decide_asset_creation(uuid,boolean,text) to authenticated;
