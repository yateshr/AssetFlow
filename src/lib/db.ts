/**
 * Data layer: Supabase is the single source of truth.
 *
 * - `hydrate()` loads every record once after sign-in into an in-memory cache.
 * - `useCollection()` gives components a normal React list; every change is
 *   diffed against the previous list and written through to the database.
 * - `kv` is a drop-in replacement for localStorage (getItem/setItem/removeItem)
 *   for module-level data, also stored in Supabase.
 *
 * Access control is enforced by Row Level Security (see supabase/migrations).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabase';
import type { Company, CompanyAccessGrant, CompanySummary, TransferRequest } from '@/data/models';

export type Doc = { id: string };

const cache = new Map<string, Map<string, unknown>>();
let activeCompanyId: string | null = null;

export function getActiveCompanyId() { return activeCompanyId; }

export type TagSeparator = '-' | '.' | '_' | '/' | '';
export type AssetTagSiteSeries = { id: string; siteId: string; companyPrefix: string; functionPrefix: string; series: string; nextNumber: number; digits: number; active: boolean; separator: TagSeparator; useFunctionPrefix: boolean };

export async function loadAssetTagSiteSeries(companyId = getActiveCompanyId()): Promise<AssetTagSiteSeries[]> {
  if (!companyId) return [];
  const { data, error } = await client().rpc('assetflow_list_asset_tag_site_series', { p_company_id: companyId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ id: row.id, siteId: row.site_id, companyPrefix: row.company_prefix, functionPrefix: row.function_prefix, series: row.series, nextNumber: Number(row.next_number), digits: Number(row.digits), active: row.active, separator: (row.separator ?? '-') as TagSeparator, useFunctionPrefix: row.use_function_prefix ?? true }));
}

export async function saveAssetTagSiteSeries(rule: AssetTagSiteSeries, companyId = getActiveCompanyId()): Promise<string> {
  if (!companyId) throw new Error('No company is selected.');
  const { data, error } = await client().rpc('assetflow_save_asset_tag_site_series', { p_company_id: companyId, p_rule: rule });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Sets the separator and function-prefix choice for every site of the company at once. Existing asset tags are not changed. */
export async function setAssetTagFormat(separator: TagSeparator, useFunctionPrefix: boolean, companyId = getActiveCompanyId()): Promise<number> {
  if (!companyId) throw new Error('No company is selected.');
  const { data, error } = await client().rpc('assetflow_set_asset_tag_format', { p_company_id: companyId, p_separator: separator, p_use_function_prefix: useFunctionPrefix });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function reserveAssetTags(siteId: string, typeCode: string, quantity = 1, companyId = getActiveCompanyId()): Promise<string[]> {
  if (!companyId) throw new Error('No company is selected.');
  const { data, error } = await client().rpc('assetflow_reserve_asset_tags', { p_company_id: companyId, p_site_id: siteId, p_type_code: typeCode, p_quantity: quantity });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => row.asset_tag as string);
}

export async function createTaggedAssets(siteId: string, typeCode: string, assets: Array<Record<string, unknown>>, invoiceId?: string, invoiceItemId?: string, companyId = getActiveCompanyId()): Promise<Record<string, unknown>[]> {
  if (!companyId) throw new Error('No company is selected.');
  const { data, error } = await client().rpc('assetflow_create_tagged_assets', { p_company_id: companyId, p_site_id: siteId, p_type_code: typeCode, p_assets: assets, p_invoice_id: invoiceId || null, p_invoice_item_id: invoiceItemId || null });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
export async function reverseInvoiceReceipt(assetId:string, reason:string, companyId=getActiveCompanyId()):Promise<Record<string,unknown>> { if(!companyId)throw new Error('No company is selected.'); const {data,error}=await client().rpc('assetflow_reverse_invoice_receipt',{p_company_id:companyId,p_asset_id:assetId,p_reason:reason}); if(error)throw new Error(error.message); return data as Record<string,unknown>; }

export async function loadCompanies(): Promise<Company[]> {
  const { data, error } = await client().rpc('assetflow_company_context');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id, name: row.name, legalName: row.legal_name ?? '', code: row.code,
    defaultCurrency: row.default_currency, timezone: row.timezone,
    registeredAddress: row.registered_address ?? '', billingAddress: row.billing_address ?? '',
    registeredCountry: row.registered_country ?? '', registeredState: row.registered_state ?? '', registeredCity: row.registered_city ?? '',
    taxId: row.tax_id ?? '', contactEmail: row.contact_email ?? '', contactPhone: row.contact_phone ?? '',
    primarySiteId: row.primary_location_id ?? '',
    active: row.active, accessRole: row.access_role,
  }));
}

export async function saveCompany(company: Partial<Company> & Pick<Company, 'name' | 'code'>): Promise<string> {
  const { data, error } = await client().rpc('assetflow_save_company', { p_company: company });
  if (error) throw new Error(error.message);
  return data as string;
}
export async function deleteCompany(companyId: string): Promise<void> {
  const { error } = await client().rpc('assetflow_delete_company', { p_company_id: companyId });
  if (error) throw new Error(error.message);
}

export async function loadAccessGrants(): Promise<CompanyAccessGrant[]> {
  const {data,error}=await client().rpc('assetflow_list_access_grants'); if(error)throw new Error(error.message);
  return (data??[]).map((x:any)=>({id:x.id,companyId:x.company_id,email:x.email,role:x.role,siteId:x.site_id??'',active:x.active}));
}
export async function saveAccessGrant(grant: CompanyAccessGrant): Promise<string> {
  const {data,error}=await client().rpc('assetflow_save_access_grant',{p_grant:grant}); if(error)throw new Error(error.message); return data as string;
}
export async function loadConsolidatedSummary(): Promise<CompanySummary[]> {
  const {data,error}=await client().rpc('assetflow_consolidated_summary'); if(error)throw new Error(error.message);
  return (data??[]).map((x:any)=>({companyId:x.company_id,companyName:x.company_name,companyCode:x.company_code,sites:Number(x.sites),users:Number(x.users),assets:Number(x.assets),assigned:Number(x.assigned),maintenance:Number(x.maintenance),assetValue:Number(x.asset_value),openCalls:Number(x.open_calls),invoiceTotal:Number(x.invoice_total)}));
}
export async function transferAsset(input:{sourceCompanyId:string;targetCompanyId:string;assetId:string;targetSiteId?:string;newAssetTag:string;reason:string}) {
  const {error}=await client().rpc('assetflow_transfer_asset',{p_source_company_id:input.sourceCompanyId,p_target_company_id:input.targetCompanyId,p_asset_id:input.assetId,p_target_site_id:input.targetSiteId||null,p_new_asset_tag:input.newAssetTag,p_reason:input.reason}); if(error)throw new Error(error.message);
}
export async function transferEmployee(input:{sourceCompanyId:string;targetCompanyId:string;employeeId:string;targetSiteId?:string;targetDepartment:string;reason:string}) {
  const {error}=await client().rpc('assetflow_transfer_employee',{p_source_company_id:input.sourceCompanyId,p_target_company_id:input.targetCompanyId,p_employee_id:input.employeeId,p_target_site_id:input.targetSiteId||null,p_target_department:input.targetDepartment,p_reason:input.reason}); if(error)throw new Error(error.message);
}
export async function listTransferLocations(sourceCompanyId:string,targetCompanyId:string): Promise<Array<{id:string;name:string}>> {
  const {data,error}=await client().rpc('assetflow_list_transfer_locations',{p_source_company_id:sourceCompanyId,p_target_company_id:targetCompanyId}); if(error)throw new Error(error.message);
  return (data??[]).map((row:any)=>({id:row.id,name:row.name}));
}
export async function requestTransfer(input:{requestType:'asset'|'employee';sourceCompanyId:string;sourceSiteId?:string;targetCompanyId:string;targetSiteId?:string;targetDepartment?:string;entityId:string;newAssetTag?:string;reason:string}): Promise<string> {
  const {data,error}=await client().rpc('assetflow_request_transfer',{p_request:input}); if(error)throw new Error(error.message); return data as string;
}
export async function listTransferRequests(): Promise<TransferRequest[]> {
  const {data,error}=await client().rpc('assetflow_list_transfer_requests'); if(error)throw new Error(error.message);
  return (data??[]).map((row:any)=>({id:row.id,requestType:row.request_type,sourceCompanyId:row.source_company_id,sourceSiteId:row.source_location_id||'',targetCompanyId:row.target_company_id,targetSiteId:row.target_location_id||'',targetDepartment:row.target_department||'',entityId:row.entity_id,reason:row.reason,status:row.status,requestedAssetTag:row.requested_asset_tag||'',requestedAt:row.requested_at,decisionNote:row.decision_note||''}));
}
export async function decideTransferRequest(id:string,approve:boolean,note=''): Promise<void> {
  const {error}=await client().rpc('assetflow_decide_transfer',{p_request_id:id,p_approve:approve,p_note:note}); if(error)throw new Error(error.message);
}

// ----------------------------------------------------- asset requests (no invoice)
export interface AssetRequestItem { name: string; serialNumber: string; manufacturer?: string; model?: string; purchaseDate?: string; purchasePrice?: number; warrantyExpiry?: string; }
export interface AssetCreationRequest {
  id: string; siteId: string; assetType: string; items: AssetRequestItem[]; reason: string;
  status: 'pending' | 'approved' | 'rejected'; requestedByEmail: string; requestedAt: string; decidedAt?: string; decisionNote?: string; createdAssetIds?: string[];
}
export async function requestAssetCreation(input: { siteId: string; assetType: string; reason: string; items: AssetRequestItem[] }, companyId = getActiveCompanyId()): Promise<string> {
  if (!companyId) throw new Error('No company is selected.');
  const { data, error } = await client().rpc('assetflow_request_asset_creation', { p_company_id: companyId, p_request: input });
  if (error) throw new Error(error.message);
  return data as string;
}
export async function listAssetCreationRequests(companyId = getActiveCompanyId()): Promise<AssetCreationRequest[]> {
  if (!companyId) return [];
  const { data, error } = await client().rpc('assetflow_list_asset_creation_requests', { p_company_id: companyId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id: r.id, siteId: r.site_id, assetType: r.asset_type, items: r.items ?? [], reason: r.reason, status: r.status, requestedByEmail: r.requested_by_email ?? '', requestedAt: r.requested_at, decidedAt: r.decided_at ?? undefined, decisionNote: r.decision_note ?? undefined, createdAssetIds: r.created_asset_ids ?? undefined }));
}
export async function decideAssetCreation(id: string, approve: boolean, note = ''): Promise<void> {
  const { error } = await client().rpc('assetflow_decide_asset_creation', { p_request_id: id, p_approve: approve, p_note: note });
  if (error) throw new Error(error.message);
}

function bucket(collection: string) {
  let b = cache.get(collection);
  if (!b) cache.set(collection, (b = new Map()));
  return b;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. See README.md.');
  return supabase;
}

// ---------------------------------------------------------------- write queue
// Writes are applied strictly in order so an upsert and a later delete of the
// same row can never be reordered.
let queue: Promise<void> = Promise.resolve();
let failures = 0;

function enqueue(label: string, job: () => PromiseLike<{ error: { message: string } | null }>) {
  queue = queue.then(async () => {
    try {
      const { error } = await job();
      if (error) throw new Error(error.message);
    } catch (e) {
      failures++;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[db] ${label} failed:`, message);
      toast.error('Could not save changes', {
        description: /row-level security/i.test(message)
          ? 'Your role does not allow this change.'
          : message,
      });
    }
  });
  return queue;
}

export function pendingWrites() {
  return queue;
}
export function saveFailureCount() {
  return failures;
}

function chunk<T>(items: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function upsertRows(collection: string, items: Doc[]) {
  if (!activeCompanyId) throw new Error('No company is selected.');
  for (const part of chunk(items)) {
    if(collection==='site-areas') { enqueue(`upsert ${collection}`,()=>client().rpc('assetflow_save_site_areas',{p_company_id:activeCompanyId,p_items:part})); continue; }
    enqueue(`upsert ${collection}`, () =>
      client()
        .rpc('assetflow_upsert_company_records', { p_company_id: activeCompanyId, p_collection: collection, p_items: part })
    );
  }
}

function deleteRows(collection: string, ids: string[]) {
  if (!activeCompanyId) throw new Error('No company is selected.');
  for (const part of chunk(ids)) {
    if(collection==='site-areas') { enqueue(`delete ${collection}`,()=>client().rpc('assetflow_delete_site_areas',{p_company_id:activeCompanyId,p_ids:part})); continue; }
    enqueue(`delete ${collection}`, () => client().rpc('assetflow_delete_company_records', { p_company_id: activeCompanyId, p_collection: collection, p_ids: part }));
  }
}

// -------------------------------------------------------------------- loading
export async function hydrate(companyId?: string): Promise<void> {
  if (companyId) activeCompanyId = companyId;
  if (!activeCompanyId) {
    const companies = await loadCompanies();
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('assetflow-company-id') : null;
    activeCompanyId = companies.find(company => company.id === saved && company.active)?.id ?? companies.find(company=>company.active)?.id ?? null;
  }
  if (!activeCompanyId) throw new Error('No accessible company exists. Ask a workspace administrator to create one.');
  if (typeof localStorage !== 'undefined') localStorage.setItem('assetflow-company-id', activeCompanyId);
  cache.clear();
  const db = client();
  const { data, error } = await db.rpc('assetflow_read_company_records', { p_company_id: activeCompanyId });
  if (error) throw new Error(`${error.message}. Apply the latest Supabase migrations before starting AssetFlow.`);
  for (const row of data ?? []) bucket(row.collection).set(row.id, row.data);
}

export function clearCache() {
  cache.clear();
}

export function getCollection<T>(collection: string): T[] {
  return Array.from(bucket(collection).values()) as T[];
}

/** Add or update records without touching the rest of the collection. */
export async function upsertIntoCollection<T extends Doc>(collection: string, items: T[]) {
  if (!items.length) return;
  const b = bucket(collection);
  items.forEach(i => b.set(i.id, i));
  upsertRows(collection, items);
  await queue;
}

/** Replace a whole collection (used by the demo-data importer). */
export async function replaceCollection<T extends Doc>(collection: string, items: T[]) {
  const b = bucket(collection);
  const previousIds = Array.from(b.keys());
  const nextIds = new Set(items.map(item => item.id));
  const removed = previousIds.filter(id => !nextIds.has(id));
  b.clear();
  items.forEach(i => b.set(i.id, i));
  if (removed.length) deleteRows(collection, removed);
  upsertRows(collection, items);
  await queue;
}

/** Remove every record except the listed collections. Returns when persisted. */
export async function eraseAll(keep: string[] = ['users']) {
  for (const name of Array.from(cache.keys())) {
    if (keep.includes(name)) continue;
    const ids=Array.from(bucket(name).keys());
    cache.delete(name);
    if(ids.length) deleteRows(name,ids);
  }
  await queue;
}

function saveDiff<T extends Doc>(collection: string, prev: T[], next: T[]) {
  const b = bucket(collection);
  const before = new Map(prev.map(p => [p.id, JSON.stringify(p)]));
  const nextIds = new Set<string>();
  const changed: T[] = [];
  for (const item of next) {
    nextIds.add(item.id);
    if (before.get(item.id) !== JSON.stringify(item)) changed.push(item);
  }
  const removed = prev.filter(p => !nextIds.has(p.id)).map(p => p.id);

  b.clear();
  next.forEach(i => b.set(i.id, i));

  if (changed.length) upsertRows(collection, changed);
  if (removed.length) deleteRows(collection, removed);
}

// ---------------------------------------------------------------- React hook
type Updater<T> = T[] | ((prev: T[]) => T[]);

// Components using the same collection stay in sync: a change made anywhere is
// pushed to every other mounted hook for that collection.
type Subscriber = (items: unknown[]) => void;
const subscribers = new Map<string, Set<Subscriber>>();

function publish(collection: string, items: unknown[], except: Subscriber) {
  subscribers.get(collection)?.forEach(fn => { if (fn !== except) fn(items); });
}

export function useCollection<T extends Doc>(collection: string): [T[], (value: Updater<T>) => void] {
  const [list, setList] = useState<T[]>(() => getCollection<T>(collection));
  const latest = useRef(list);
  const self = useRef<Subscriber>(() => {});

  useEffect(() => {
    self.current = (items: unknown[]) => { latest.current = items as T[]; setList(items as T[]); };
    const fn = self.current;
    let set = subscribers.get(collection);
    if (!set) subscribers.set(collection, (set = new Set()));
    set.add(fn);
    return () => { set!.delete(fn); };
  }, [collection]);

  const update = useCallback(
    (value: Updater<T>) => {
      const prev = latest.current;
      const next = typeof value === 'function' ? (value as (p: T[]) => T[])(prev) : value;
      if (next === prev) return;
      latest.current = next;
      setList(next);
      saveDiff(collection, prev, next);
      publish(collection, next, self.current);
    },
    [collection]
  );

  return [list, update];
}

// ------------------------------------------------------- localStorage-style kv
const KV = 'kv';
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const dirty = new Set<string>();

function flushKey(key: string) {
  timers.delete(key);
  dirty.delete(key);
  const value = bucket(KV).get(key) as { id: string; value: string } | undefined;
  if (value) upsertRows(KV, [value]);
}

export function flushKv() {
  for (const key of Array.from(dirty)) {
    clearTimeout(timers.get(key));
    flushKey(key);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushKv);
}

/** Same shape as localStorage, but backed by the database. */
export const kv = {
  getItem(key: string): string | null {
    const row = bucket(KV).get(key) as { value: string } | undefined;
    return row ? row.value : null;
  },
  setItem(key: string, value: string) {
    const current = bucket(KV).get(key) as { value: string } | undefined;
    if (current && current.value === value) return;
    bucket(KV).set(key, { id: key, value });
    dirty.add(key);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => flushKey(key), 600));
  },
  removeItem(key: string) {
    if (!bucket(KV).delete(key)) return;
    clearTimeout(timers.get(key));
    timers.delete(key);
    dirty.delete(key);
    deleteRows(KV, [key]);
  },
  keys(): string[] {
    return Array.from(bucket(KV).keys());
  },
};
