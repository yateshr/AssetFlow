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
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabase';

export type Doc = { id: string };

const PAGE = 1000;
const cache = new Map<string, Map<string, unknown>>();

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
  for (const part of chunk(items)) {
    enqueue(`upsert ${collection}`, () =>
      client()
        .from('records')
        .upsert(part.map(d => ({ collection, id: d.id, data: d })), { onConflict: 'collection,id' })
    );
  }
}

function deleteRows(collection: string, ids: string[]) {
  for (const part of chunk(ids)) {
    enqueue(`delete ${collection}`, () =>
      client().from('records').delete().eq('collection', collection).in('id', part)
    );
  }
}

// -------------------------------------------------------------------- loading
export async function hydrate(): Promise<void> {
  cache.clear();
  const db = client();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('records')
      .select('collection,id,data')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) bucket(row.collection).set(row.id, row.data);
    if (!data || data.length < PAGE) break;
  }
}

export function clearCache() {
  cache.clear();
}

export function getCollection<T>(collection: string): T[] {
  return Array.from(bucket(collection).values()) as T[];
}

/** Replace a whole collection (used by the demo-data importer). */
export async function replaceCollection<T extends Doc>(collection: string, items: T[]) {
  const b = bucket(collection);
  b.clear();
  items.forEach(i => b.set(i.id, i));
  upsertRows(collection, items);
  await queue;
}

/** Remove every record except the listed collections. Returns when persisted. */
export async function eraseAll(keep: string[] = ['users']) {
  for (const name of Array.from(cache.keys())) if (!keep.includes(name)) cache.delete(name);
  const keepList = `(${keep.map(k => `"${k}"`).join(',')})`;
  await enqueue('erase all', () => client().from('records').delete().not('collection', 'in', keepList));
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

export function useCollection<T extends Doc>(collection: string): [T[], (value: Updater<T>) => void] {
  const [list, setList] = useState<T[]>(() => getCollection<T>(collection));
  const latest = useRef(list);

  const update = useCallback(
    (value: Updater<T>) => {
      const prev = latest.current;
      const next = typeof value === 'function' ? (value as (p: T[]) => T[])(prev) : value;
      if (next === prev) return;
      latest.current = next;
      setList(next);
      saveDiff(collection, prev, next);
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
