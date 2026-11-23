import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Location, User } from '@/data/models';
import { kv, loadAssetTagSiteSeries, useCollection } from '@/lib/db';
import type { Page } from './App';

const HIDDEN_KEY = 'assetflow-setup-guide-hidden';

interface Step {
  key: string;
  title: string;
  help: string;
  done: boolean;
  go: () => void;
  action: string;
}

/**
 * First-run checklist on the dashboard: site, numbering, departments, employees, first asset, labels.
 * Each step is ticked from real data, so it also works as a "what is left to set up" reminder.
 */
export function SetupGuide({ onNavigate, assetCount, users }: { onNavigate: (page: Page) => void; assetCount: number; users: User[] }) {
  const [sites] = useCollection<Location>('locations');
  const [departments] = useCollection<{ id: string }>('departments');
  const [numberedSites, setNumberedSites] = useState<number | null>(null);
  const [hidden, setHidden] = useState(() => { try { return kv.getItem(HIDDEN_KEY) === '1'; } catch { return false; } });

  useEffect(() => { void loadAssetTagSiteSeries().then(rules => setNumberedSites(rules.filter(r => r.active).length)).catch(() => setNumberedSites(0)); }, [sites.length]);

  const openSettings = (section: string) => {
    try { sessionStorage.setItem('assetflow-settings-section', section); } catch { /* ignore */ }
    onNavigate('settings');
  };

  const steps: Step[] = [
    { key: 'site', title: 'Add your first site', help: 'An office, plant or warehouse. Assets, employees and numbering belong to a site.', done: sites.length > 0, go: () => onNavigate('locations'), action: 'Add a site' },
    { key: 'numbering', title: 'Set up asset numbering', help: 'Choose how asset tags look at each site, for example NP-IT-LAP-A0001.', done: (numberedSites ?? 0) > 0, go: () => openSettings('asset-setup'), action: 'Set up numbering' },
    { key: 'departments', title: 'Add departments', help: 'The departments each site uses. Open Employees and use the Departments section.', done: departments.length > 0, go: () => onNavigate('users'), action: 'Open Employees' },
    { key: 'employees', title: 'Add employees', help: 'Add people, or invite IT staff who will sign in.', done: users.length > 1, go: () => onNavigate('users'), action: 'Add employees' },
    { key: 'asset', title: 'Register your first asset', help: 'Add one by hand, create a batch from an invoice, or import a workbook in Data Management.', done: assetCount > 0, go: () => onNavigate('assets'), action: 'Add an asset' },
    { key: 'labels', title: 'Print asset labels', help: 'Open an asset and print a QR label for your sticker size.', done: (() => { try { return kv.getItem('assetflow-label-settings') !== null; } catch { return false; } })(), go: () => onNavigate('assets'), action: 'Open assets' },
  ];
  const done = steps.filter(s => s.done).length;
  if (done === steps.length) return null;
  if (hidden) {
    return <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setHidden(false); try { kv.removeItem(HIDDEN_KEY); } catch { /* ignore */ } }}>Show the setup guide ({done} of {steps.length} steps done)</button>;
  }
  const next = steps.find(s => !s.done);

  return (
    <Card className="af-scale-in border-primary/30">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Getting started <span className="ml-1 text-sm font-normal text-muted-foreground">{done} of {steps.length} done</span></p>
            <p className="mt-0.5 text-sm text-muted-foreground">Finish these steps and AssetFlow is ready for your team.</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Hide the setup guide" title="Hide" onClick={() => { setHidden(true); try { kv.setItem(HIDDEN_KEY, '1'); } catch { /* ignore */ } }}><X className="h-4 w-4" /></Button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
        <ol className="grid gap-2 md:grid-cols-2">
          {steps.map(s => (
            <li key={s.key} className={`flex items-start gap-3 rounded-lg border p-3 ${s.done ? 'bg-muted/30' : next?.key === s.key ? 'border-primary/40 bg-primary/5' : ''}`}>
              {s.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" aria-label="Done" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="To do" />}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${s.done ? 'text-muted-foreground line-through' : ''}`}>{s.title}</p>
                {!s.done && <p className="mt-0.5 text-xs text-muted-foreground">{s.help}</p>}
                {!s.done && <Button size="sm" variant={next?.key === s.key ? 'default' : 'outline'} className="mt-2" onClick={s.go}>{s.action}</Button>}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
