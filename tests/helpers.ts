/** In-memory stand-in for src/lib/db.ts so logic can be tested without a database. */
export const store = new Map<string, Map<string, any>>();
export const kvStore = new Map<string, string>();
let failures = 0;

export function resetStore() {
  store.clear();
  kvStore.clear();
  failures = 0;
}
export function seed(collection: string, items: any[]) {
  store.set(collection, new Map(items.map(i => [i.id, i])));
}
export const rows = (collection: string) => Array.from(store.get(collection)?.values() ?? []);
export const setFailures = (n: number) => { failures = n; };

export function mockDb() {
  return {
    getCollection: (name: string) => rows(name),
    upsertIntoCollection: async (name: string, items: any[]) => {
      const bucket = store.get(name) ?? new Map();
      items.forEach(i => bucket.set(i.id, i));
      store.set(name, bucket);
    },
    replaceCollection: async (name: string, items: any[]) => seed(name, items),
    pendingWrites: async () => undefined,
    saveFailureCount: () => failures,
    kv: {
      getItem: (k: string) => kvStore.get(k) ?? null,
      setItem: (k: string, v: string) => { kvStore.set(k, v); },
      removeItem: (k: string) => { kvStore.delete(k); },
    },
  };
}
