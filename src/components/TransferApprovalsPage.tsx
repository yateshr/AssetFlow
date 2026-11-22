import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AssetRequestsPanel } from '@/components/AssetRequestsPanel';
import { DecisionDialog } from '@/components/DecisionDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { decideTransferRequest, listTransferRequests } from '@/lib/db';
import type { Company, TransferRequest } from '@/data/models';

/** Everything a site IT admin has asked the Super Admin to approve: new assets without an invoice, and transfers. */
export function TransferApprovalsPage({ companies }: { companies: Company[] }) {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [busy, setBusy] = useState('');
  const [pending, setPending] = useState<{ request: TransferRequest; approve: boolean } | null>(null);

  const load = async () => {
    try { setRequests(await listTransferRequests()); }
    catch (error) { toast.error('Could not load transfer requests', { description: error instanceof Error ? error.message : String(error) }); }
  };
  useEffect(() => { void load(); }, []);

  const decide = async (note: string) => {
    if (!pending) return;
    const { request, approve } = pending;
    setBusy(request.id);
    try {
      await decideTransferRequest(request.id, approve, note);
      toast.success(approve ? 'Transfer approved and completed' : 'Transfer request rejected');
      setPending(null);
      await load();
    } catch (error) {
      toast.error('Could not decide transfer', { description: error instanceof Error ? error.message : String(error) });
    } finally { setBusy(''); }
  };

  const company = (id: string) => companies.find(item => item.id === id)?.name || id;
  const waiting = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="af-stagger space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
        <p className="text-muted-foreground">Requests from site IT teams: assets without an invoice, and transfers between companies.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Asset requests <span className="text-sm font-normal text-muted-foreground">(no invoice)</span></h2>
        <AssetRequestsPanel canDecide />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Transfers {waiting > 0 && <Badge variant="secondary" className="ml-1">{waiting} waiting</Badge>}</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No transfer requests.</TableCell></TableRow>
                ) : requests.map(request => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <p className="font-medium capitalize">{request.requestType} transfer</p>
                      <p className="font-mono text-xs text-muted-foreground">{request.entityId}{request.requestedAssetTag ? ` → ${request.requestedAssetTag}` : ''}</p>
                    </TableCell>
                    <TableCell>{company(request.sourceCompanyId)}</TableCell>
                    <TableCell>
                      {company(request.targetCompanyId)}
                      {request.targetDepartment && <p className="text-xs text-muted-foreground">Department: {request.targetDepartment}</p>}
                    </TableCell>
                    <TableCell className="max-w-64 truncate">{request.reason}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{request.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {request.status === 'pending' && (
                          <>
                            <Button size="sm" disabled={busy === request.id} onClick={() => setPending({ request, approve: true })}><Check className="h-4 w-4" />Approve</Button>
                            <Button size="sm" variant="outline" disabled={busy === request.id} onClick={() => setPending({ request, approve: false })}><X className="h-4 w-4" />Reject</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <DecisionDialog
        open={!!pending} approve={!!pending?.approve} busy={!!busy}
        title={pending?.approve ? 'Approve this transfer?' : 'Reject this transfer?'}
        description={pending ? `${pending.request.requestType} transfer ${pending.request.entityId}` : undefined}
        onCancel={() => setPending(null)} onConfirm={note => void decide(note)}
      />
    </div>
  );
}
