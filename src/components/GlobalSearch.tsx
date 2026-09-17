import { useMemo, useState } from 'react';
import { Search, Package, Users, Truck, MapPin, Receipt, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Asset, User, Vendor, Location, Invoice } from '@/data/sampleData';
import type { Page } from './App';

interface GlobalSearchProps {
  assets: Asset[];
  users: User[];
  vendors: Vendor[];
  locations: Location[];
  invoices: Invoice[];
  onNavigate: (page: Page) => void;
}

type Result = {
  id: string; title: string; subtitle: string;
  type: string; page: Page; Icon: typeof Package;
};

export function GlobalSearch({ assets, users, vendors, locations, invoices, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const results = useMemo<Result[]>(() => {
    if (!q) return [];
    const out: Result[] = [];
    const add = (id: string, title: string, subtitle: string, type: string, page: Page, Icon: typeof Package) =>
      out.length < 15 && out.push({ id, title, subtitle, type, page, Icon });

    assets.forEach(a => {
      if ([a.name, a.assetTag, a.serialNumber, a.manufacturer, a.model, a.status, a.location].some(v => v?.toLowerCase().includes(q))) {
        add(`asset-${a.id}`, a.name, `${a.assetTag} • ${a.manufacturer} ${a.model}`, 'Asset', 'assets', Package);
      }
    });
    users.forEach(u => {
      if ([u.name, u.email, u.department, u.phone, u.role, u.status].some(v => v?.toLowerCase().includes(q))) {
        add(`user-${u.id}`, u.name, `${u.email} • ${u.department}`, 'User', 'users', Users);
      }
    });
    vendors.forEach(v => {
      if ([v.name, v.contactPerson, v.email, v.phone, v.category, v.website, v.taxId].some(vv => vv?.toLowerCase().includes(q))) {
        add(`vendor-${v.id}`, v.name, `${v.contactPerson || 'No contact'} • ${v.category || 'Vendor'}`, 'Vendor', 'vendors', Truck);
      }
    });
    locations.forEach(l => {
      if ([l.name, l.address, l.type, l.manager].some(v => v?.toLowerCase().includes(q))) {
        add(`location-${l.id}`, l.name, `${l.type} • ${l.address || 'Location'}`, 'Location', 'locations', MapPin);
      }
    });
    invoices.forEach(i => {
      if ([i.invoiceNumber, i.poNumber, i.status, i.currency, i.paymentTerms].some(v => v?.toLowerCase().includes(q))) {
        add(`invoice-${i.id}`, i.invoiceNumber, `${i.status} • ${i.currency} ${i.total.toLocaleString()}`, 'Invoice', 'invoices', Receipt);
      }
    });
    return out;
  }, [q, assets, users, vendors, locations, invoices]);

  return (
    <div className="relative hidden sm:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10 text-muted-foreground" />
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && setQuery('')}
        placeholder="Search assets, people, vendors, invoices..."
        className="pl-9 pr-9 w-[300px] lg:w-[420px]"
      />
      {query && <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onClick={() => setQuery('')} aria-label="Clear"><X className="h-4 w-4" /></button>}
      {q && (
        <div className="absolute z-[100] top-full mt-2 left-0 right-0 overflow-hidden rounded-lg border bg-popover shadow-xl">
          {results.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No matching records found.</div> :
            <div className="max-h-[430px] overflow-y-auto py-1">
              {results.map(r => (
                <button key={r.id} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted" onClick={() => { onNavigate(r.page); setQuery(''); }}>
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0"><r.Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><div className="flex gap-2 items-center"><span className="text-sm font-medium truncate">{r.title}</span><Badge variant="outline" className="text-[10px]">{r.type}</Badge></div><p className="text-xs text-muted-foreground truncate">{r.subtitle}</p></div>
                </button>
              ))}
            </div>}
        </div>
      )}
    </div>
  );
}
