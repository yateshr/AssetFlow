create or replace function public.assetflow_reverse_invoice_receipt(p_company_id uuid,p_asset_id text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_asset jsonb; v_invoice jsonb; v_line jsonb; v_index integer; v_invoice_id text; v_item_id text;
begin
  if not assetflow_is_workspace_admin() then raise exception 'Only the Super Admin can reverse an invoice receipt'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'A correction reason is required'; end if;
  select data into v_asset from assets where company_id=p_company_id and id=p_asset_id for update;
  if not found then raise exception 'Asset not found'; end if;
  v_invoice_id:=nullif(v_asset->>'invoiceId',''); v_item_id:=nullif(v_asset->>'invoiceItemId','');
  if v_invoice_id is null or v_item_id is null then raise exception 'This asset is not linked to an invoice line'; end if;
  select data into v_invoice from invoices where company_id=p_company_id and id=v_invoice_id for update;
  select value,ordinality::integer-1 into v_line,v_index from jsonb_array_elements(v_invoice->'lineItems') with ordinality where value->>'id'=v_item_id;
  if v_line is null then raise exception 'Invoice line not found'; end if;
  v_line:=jsonb_set(v_line,'{receivedQuantity}',to_jsonb(greatest(0,coalesce((v_line->>'receivedQuantity')::integer,0)-1)));
  v_invoice:=jsonb_set(v_invoice,array['lineItems',v_index::text],v_line);
  update invoices set data=v_invoice where company_id=p_company_id and id=v_invoice_id;
  update invoice_line_items set data=v_line where company_id=p_company_id and invoice_id=v_invoice_id and id=v_item_id;
  v_asset:=(v_asset-'invoiceId'-'invoiceItemId')||jsonb_build_object('receiptReversedAt',now(),'receiptReversalReason',trim(p_reason));
  update assets set data=v_asset where company_id=p_company_id and id=p_asset_id;
  return v_asset;
end $$;
grant execute on function public.assetflow_reverse_invoice_receipt(uuid,text,text) to authenticated;
