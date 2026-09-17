import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, BellRing, CheckCircle2, Package, Wrench, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Asset } from '@/data/sampleData';

type Notice = {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
};

interface Props {
  assets: Asset[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: (count: number) => void;
}

const readKey = 'assetflow-notifications-read';

export function GlobalNotificationCenter({ assets, open, onOpenChange, onCountChange }: Props) {
  const [read, setRead] = useState<Record<string, boolean>>({});

  const loadRead = () => {
    try {
      const raw = localStorage.getItem(readKey);
      setRead(raw ? JSON.parse(raw) : {});
    } catch {
      setRead({});
    }
  };

  useEffect(() => {
    loadRead();
  }, []);

  const notifications = useMemo<Notice[]>(() => {
    const result: Notice[] = [];
    const now = Date.now();

    assets.forEach(asset => {
      const expiry = new Date(asset.warrantyExpiry).getTime();
      if (Number.isFinite(expiry)) {
        const days = Math.ceil((expiry - now) / 86400000);
        if (days <= 90) {
          result.push({
            id: `warranty-${asset.id}`,
            title: days < 0 ? 'Warranty expired' : 'Warranty expiring soon',
            detail: `${asset.assetTag} • ${asset.name} • ${days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`}`,
            severity: days < 0 ? 'critical' : 'warning',
            createdAt: asset.warrantyExpiry,
          });
        }
      }
    });

    try {
      const stock = JSON.parse(localStorage.getItem('assetflow-stock') || '[]');
      stock.forEach((item: { id: string; name: string; quantity: number; minQuantity: number }) => {
        if (item.quantity <= item.minQuantity) {
          result.push({
            id: `stock-${item.id}`,
            title: 'Low stock',
            detail: `${item.name} • ${item.quantity} available (minimum ${item.minQuantity})`,
            severity: 'warning',
            createdAt: new Date().toISOString(),
          });
        }
      });
    } catch {}

    try {
      const infra = JSON.parse(localStorage.getItem('assetflow-infrastructure') || '[]');
      infra.forEach((item: { id: string; name: string; status: string }) => {
        if (item.status === 'offline') {
          result.push({
            id: `infra-${item.id}`,
            title: 'Infrastructure device offline',
            detail: `${item.name} is currently marked offline.`,
            severity: 'critical',
            createdAt: new Date().toISOString(),
          });
        }
      });
    } catch {}

    try {
      const requests = JSON.parse(localStorage.getItem('assetflow-asset-requests') || '[]');
      requests.forEach((item: { id: string; assetType: string; status: string }) => {
        if (item.status === 'pending') {
          result.push({
            id: `request-${item.id}`,
            title: 'Asset request pending',
            detail: `${item.assetType} request ${item.id} is waiting for action.`,
            severity: 'info',
            createdAt: new Date().toISOString(),
          });
        }
      });
    } catch {}

    try {
      const maintenance = JSON.parse(localStorage.getItem('assetflow-maintenance') || '[]');
      maintenance.forEach((item: { id: string; assetId: string; status: string }) => {
        if (item.status === 'open' || item.status === 'in-progress') {
          const asset = assets.find(a => a.id === item.assetId);
          result.push({
            id: `maintenance-${item.id}`,
            title: 'Maintenance in progress',
            detail: `${asset?.assetTag || item.assetId} has an open maintenance record.`,
            severity: 'warning',
            createdAt: new Date().toISOString(),
          });
        }
      });
    } catch {}

    return result;
  }, [assets, read, open]);

  const unread = notifications.filter(n => !read[n.id]).length;

  useEffect(() => {
    onCountChange?.(unread);
  }, [unread, onCountChange]);

  const markRead = (id: string) => {
    const next = { ...read, [id]: true };
    setRead(next);
    localStorage.setItem(readKey, JSON.stringify(next));
  };

  const markAllRead = () => {
    const next = { ...read };
    notifications.forEach(n => { next[n.id] = true; });
    setRead(next);
    localStorage.setItem(readKey, JSON.stringify(next));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,720px)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" /> Smart Notification Center
          </DialogTitle>
          <DialogDescription>
            Alerts are available here from every AssetFlow page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
              <p className="font-medium">You're all caught up</p>
              <p className="text-sm text-muted-foreground">There are no active notifications.</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`flex gap-3 p-3 border rounded-lg ${read[n.id] ? 'opacity-60' : ''}`}>
                <div className="pt-0.5">
                  {n.severity === 'critical'
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : n.severity === 'warning'
                      ? <Wrench className="h-5 w-5" />
                      : <Package className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong>{n.title}</strong>
                    {!read[n.id] && <Badge>New</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.detail}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!read[n.id] && (
                  <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={markAllRead} disabled={unread === 0}>Mark all read</Button>
          <Button onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
