import { getCollection, kv, useCollection } from '@/lib/db';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, BellRing, CheckCircle2, Package, Wrench, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Asset, Invoice, ItCallLog } from '@/data/models';
import { buildExpiryAlerts, describeDays } from '@/lib/alerts';
import { slaFor } from '@/lib/sla';
import type { StockMinimum } from '@/lib/stock';
import type { MasterDataOption } from '@/data/masterData';
import type { SoftwareLicense, Vendor } from '@/data/models';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';

type Notice = {
  target?: string;
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
};

interface Props {
  assets: Asset[];
  invoices: Invoice[];
  callLogs: ItCallLog[];
  vendors?: Vendor[];
  onViewAll?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: (count: number) => void;
  trigger: ReactNode;
}

const readKey = 'assetflow-notifications-read';

export function GlobalNotificationCenter({ assets, invoices, callLogs, vendors = [], onViewAll, open, onOpenChange, onCountChange, trigger }: Props) {
  const [policies]=useCollection<SystemPolicy>('system-policies');
  const policy=policies[0]||DEFAULT_SYSTEM_POLICY;
  const [licenses]=useCollection<SoftwareLicense>('licenses');
  const [priorities]=useCollection<MasterDataOption>('call-priorities');
  const [minimums] = useCollection<StockMinimum>('stock-minimums');
  const [sites] = useCollection<{ id: string; name: string }>('locations');
  const [categories] = useCollection<{ id: string; name: string }>('asset-categories');
  const [read, setRead] = useState<Record<string, boolean>>({});

  const loadRead = () => {
    try {
      const raw = kv.getItem(readKey);
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

    const stock = {
      minimums,
      siteName: (id: string) => sites.find(s => s.id === id)?.name || id,
      typeName: (id: string) => categories.find(c => c.id === id)?.name || id,
    };
    buildExpiryAlerts({ assets, licenses, vendors, invoices, policy, stock, now: new Date(now) }).forEach(alert => {
      result.push({
        id: alert.id,
        title: alert.title,
        detail: `${alert.subject} • ${alert.date ? describeDays(alert.days) : alert.detail}`,
        severity: alert.severity,
        createdAt: alert.date || new Date(now).toISOString(),
        target: alert.target,
      });
    });
    callLogs.filter(call=>['open','in-progress'].includes(call.status)&&slaFor(call,priorities,new Date(now)).state==='breached').forEach(call=>result.push({id:`sla-${call.id}`,title:'IT call past its SLA',detail:`${call.callerName} • ${call.issue} • ${slaFor(call,priorities,new Date(now)).label}`,severity:'critical',createdAt:call.date}));
    callLogs.filter(call=>call.priority==='critical'&&['open','in-progress'].includes(call.status)).forEach(call=>result.push({id:`call-${call.id}`,title:'Critical IT call open',detail:`${call.callerName} • ${call.issue}`,severity:'critical',createdAt:call.date}));

    try {
      const stock = getCollection<{ id: string; name: string; quantity: number; minQuantity: number }>('stock-items');
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
      const infra = getCollection<{ id: string; name: string; status: string }>('infrastructure');
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
      const requests = getCollection<{ id: string; assetType: string; status: string }>('asset-requests');
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
      const maintenance = getCollection<{ id: string; assetId: string; status: string }>('maintenance');
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
  }, [assets, invoices, callLogs, licenses, vendors, priorities, minimums, sites, categories, read, open, policy.warrantyAlertDays, policy.licenseAlertDays]);

  const unread = notifications.filter(n => !read[n.id]).length;

  useEffect(() => {
    onCountChange?.(unread);
  }, [unread, onCountChange]);

  const markRead = (id: string) => {
    const next = { ...read, [id]: true };
    setRead(next);
    kv.setItem(readKey, JSON.stringify(next));
  };

  const markAllRead = () => {
    const next = { ...read };
    notifications.forEach(n => { next[n.id] = true; });
    setRead(next);
    kv.setItem(readKey, JSON.stringify(next));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(340px,calc(100vw-1rem))] overflow-hidden p-0 shadow-xl">
        <div className="border-b px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            <BellRing className="h-4 w-4" /> Notifications
            {unread > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{unread} unread</Badge>}
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            Warranty, AMC, insurance, license, contract, invoice, IT call, stock, and infrastructure alerts.
          </p>
        </div>

        <div className="max-h-[min(400px,65vh)] space-y-0.5 overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground" />
              <p className="text-[13px] font-medium">You're all caught up</p>
              <p className="text-[11px] text-muted-foreground">There are no active notifications.</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`flex gap-2 rounded-md p-2 transition-colors hover:bg-muted/60 ${read[n.id] ? 'opacity-60' : ''}`}>
                <div className="pt-0.5">
                  {n.severity === 'critical'
                    ? <AlertTriangle className="h-4 w-4 text-destructive" />
                    : n.severity === 'warning'
                      ? <Wrench className="h-4 w-4" />
                      : <Package className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[12px] leading-4">
                    <strong className="font-semibold">{n.title}</strong>
                    {!read[n.id] && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{n.detail}</p>
                  <p className="mt-0.5 text-[10px] leading-3.5 text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!read[n.id] && (
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => markRead(n.id)}>
                    Read
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t px-2.5 py-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={markAllRead} disabled={unread === 0}>Mark all read</Button>
          {onViewAll && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-primary" onClick={onViewAll}>
              View all expiry alerts
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" /> Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
