import {
  CalendarDays, UserRound, MapPin, Wrench, PackageCheck, ArrowRightLeft,
  Archive, Trash2, Search, CircleDot, AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDateTime, type Asset, type AssetHistoryEvent, type User, type Location } from '@/data/sampleData';
import { assetStatusLabel, holderName } from './assetLifecycle';

interface Props {
  asset: Asset | null;
  users: User[];
  locations: Location[];
  history: AssetHistoryEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function eventIcon(action: AssetHistoryEvent['action']) {
  switch (action) {
    case 'Purchased': return PackageCheck;
    case 'Assigned':
    case 'Returned':
    case 'Transferred': return ArrowRightLeft;
    case 'Under Repair':
    case 'Repair Completed': return Wrench;
    case 'Retired': return Archive;
    case 'Disposed': return Trash2;
    case 'Lost': return AlertTriangle;
    default: return CircleDot;
  }
}

export function AssetHistoryDialog({ asset, users, locations, history, open, onOpenChange }: Props) {
  if (!asset) return null;

  const location = locations.find((item) => item.id === asset.location);
  const events = history
    .filter((event) => event.assetId === asset.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Asset History
          </DialogTitle>
          <DialogDescription>
            Complete lifecycle for {asset.name} ({asset.assetTag})
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Current Status</p>
            <Badge variant="outline" className="mt-1">{assetStatusLabel(asset.status)}</Badge>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Current Holder</p>
            <p className="text-sm font-medium mt-1">{holderName(asset, users)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Purchase Date</p>
            <p className="text-sm font-medium mt-1">{asset.purchaseDate}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Purchase Price</p>
            <p className="text-sm font-medium mt-1">{formatCurrency(asset.purchasePrice)}</p>
          </CardContent></Card>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <MapPin className="h-4 w-4" />
          {location?.name || 'No location'}
        </div>

        <div className="relative mt-4">
          {events.map((event, index) => {
            const Icon = eventIcon(event.action);
            const actor = event.performedBy
              ? users.find((user) => user.id === event.performedBy)?.name ?? event.performedBy
              : undefined;
            const user = event.userId
              ? users.find((item) => item.id === event.userId)?.name
              : undefined;

            return (
              <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                {index < events.length - 1 && (
                  <div className="absolute left-4 top-9 bottom-0 w-px bg-border" />
                )}
                <div className="relative z-10 h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 border rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <p className="font-medium">{event.action}</p>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>

                  {(event.from || event.to) && (
                    <p className="text-sm mt-2">
                      {event.from || '—'} <span className="text-muted-foreground">→</span> {event.to || '—'}
                    </p>
                  )}

                  {user && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <UserRound className="h-3 w-3" /> User: {user}
                    </p>
                  )}
                  {actor && (
                    <p className="text-xs text-muted-foreground mt-1">Performed by: {actor}</p>
                  )}
                  {event.reason && <p className="text-sm mt-2"><strong>Reason:</strong> {event.reason}</p>}
                  {event.notes && <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>}
                  {typeof event.cost === 'number' && (
                    <p className="text-sm mt-1"><strong>Cost:</strong> {formatCurrency(event.cost)}</p>
                  )}
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No history recorded yet.</p>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogContent>
    </Dialog>
  );
}
