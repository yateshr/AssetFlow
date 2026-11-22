import { useEffect, useState } from 'react';
import { Check, ClipboardList, X } from 'lucide-react';
import { toast } from 'sonner';
import { DecisionDialog } from '@/components/DecisionDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AssetCategory, Location } from '@/data/models';
import { decideAssetCreation, listAssetCreationRequests, useCollection, type AssetCreationRequest } from '@/lib/db';
import { dmy } from '@/lib/dates';

const TONE: Record<string, string> = {
  pending: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  approved: 'bg-chart-2/10 text-chart-2 border-chart-2/25',
  rejected: 'bg-destructive/10 text-destructive border-destructive/25',
};

/**
 * Requests for assets without an invoice. A site IT admin sees their own site's requests;
 * the Super Admin sees all of them and can approve or reject.
 */
export function AssetRequestsPanel({ canDecide, refreshKey = 0 }: { canDecide: boolean; refreshKey?: number }) {
  const [requests, setRequests] = useState<AssetCreationRequest[] | null>(null);
  const [sites] = useCollection<Location>('locations');
  const [types] = useCollection<AssetCategory>('asset-categories');
  const [pending, setPending] = useState<{ request: AssetCreationRequest; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRequests(await listAssetCreationRequests()); }
    catch (e) { toast.error('Could not load asset requests', { description: e instanceof Error ? e.message : String(e) }); setRequests([]); }
  };
  useEffect(() => { void load(); }, [refreshKey]);

  const decide = async (note: string) => {
    if (!pending) return;
    setBusy(true);
    try {
      await decideAssetCreation(pending.request.id, pending.approve, note);
      if (pending.approve) {
        toast.success(`${pending.request.items.length} asset${pending.request.items.length === 1 ? '' : 's'} created`);
        // The assets were created by the database, so reload to show them everywhere.
        window.setTimeout(() => window.location.reload(), 800);
      } else {
        toast.success('Request rejected');
        setPending(null);
        await load();
      }
    } catch (e) {
      toast.error('Could not decide the request', { description: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };

  const siteName = (id: string) => sites.find(s => s.id === id)?.name || id;
  const typeName = (id: string) => types.find(t => t.id === id)?.name || id;

  if (requests === null) return <p className="text-sm text-muted-foreground">Loading requests…</p>;
  if (requests.length === 0) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-60" />No asset requests.</div>;
  }
  return (
    <>
      <ul className="space-y-3">
        {requests.map(r => (
          <li key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{r.items.length} × {typeName(r.assetType)} <span className="font-normal text-muted-foreground">for {siteName(r.siteId)}</span></p>
                <p className="text-xs text-muted-foreground">{r.requestedByEmail || 'Unknown'} · {dmy(r.requestedAt)}</p>
              </div>
              <Badge variant="outline" className={`capitalize ${TONE[r.status]}`}>{r.status}</Badge>
            </div>
            <p className="mt-2 text-sm"><span className="text-muted-foreground">Why: </span>{r.reason}</p>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Items</summary>
              <ul className="mt-1 space-y-0.5">
                {r.items.map(i => <li key={i.serialNumber}>{i.name}{i.manufacturer || i.model ? ` · ${`${i.manufacturer || ''} ${i.model || ''}`.trim()}` : ''} <span className="font-mono text-xs text-muted-foreground">S/N {i.serialNumber}</span></li>)}
              </ul>
            </details>
            {r.decisionNote && <p className="mt-2 text-sm"><span className="text-muted-foreground">Decision note: </span>{r.decisionNote}</p>}
            {r.status === 'approved' && r.createdAssetIds && <p className="mt-1 text-xs text-muted-foreground">{r.createdAssetIds.length} asset(s) created.</p>}
            {canDecide && r.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setPending({ request: r, approve: true })}><Check className="h-4 w-4" /> Approve &amp; create</Button>
                <Button size="sm" variant="outline" onClick={() => setPending({ request: r, approve: false })}><X className="h-4 w-4" /> Reject</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <DecisionDialog
        open={!!pending} approve={!!pending?.approve} busy={busy}
        title={pending?.approve ? 'Approve and create assets?' : 'Reject this request?'}
        description={pending ? `${pending.request.items.length} × ${typeName(pending.request.assetType)} for ${siteName(pending.request.siteId)}. ${pending.approve ? 'Assets are created with tags from the site numbering.' : ''}` : undefined}
        onCancel={() => setPending(null)} onConfirm={note => void decide(note)}
      />
    </>
  );
}
