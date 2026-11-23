import { isEmployee } from '@/lib/people';
import { useState } from 'react';
import { Boxes, Calculator, ClipboardList, Server, UserRound, Wrench } from 'lucide-react';
import type { Asset, AssetHistoryEvent, User } from '@/data/models';
import { InfrastructureTab } from './operations/InfrastructureTab';
import { MaintenanceTab } from './operations/MaintenanceTab';
import { RequestsTab } from './operations/RequestsTab';
import { StockTab } from './operations/StockTab';
import { DepreciationTab, MyAssetsTab } from './operations/ValueTabs';

interface OperationsPageProps {
  assetsList: Asset[];
  onAssetsChange: (assets: Asset[]) => void;
  usersList: User[];
  history: AssetHistoryEvent[];
  onHistoryChange: (events: AssetHistoryEvent[]) => void;
  currentUser: User;
  initialTab?: string;
}

const TABS = [
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'infrastructure', label: 'Infrastructure', icon: Server },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'depreciation', label: 'Depreciation', icon: Calculator },
  { id: 'my-assets', label: 'By employee', icon: UserRound },
] as const;

/**
 * IT Operations: the day-to-day jobs that are not about one asset's record.
 * Assets, reports, labels, transfers, audit trail and imports live in their own pages.
 */
export function OperationsPage({ assetsList, onAssetsChange, usersList, history, onHistoryChange, currentUser, initialTab = 'stock' }: OperationsPageProps) {
  const [tab, setTab] = useState(TABS.some(t => t.id === initialTab) ? initialTab : 'stock');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IT Operations</h1>
        <p className="text-sm text-muted-foreground">Spares, network equipment, repairs and requests.</p>
      </div>

      <div role="tablist" aria-label="IT Operations" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'stock' && <StockTab userName={currentUser.name} />}
      {tab === 'infrastructure' && <InfrastructureTab />}
      {tab === 'maintenance' && <MaintenanceTab assets={assetsList} onAssetsChange={onAssetsChange} history={history} onHistoryChange={onHistoryChange} currentUser={currentUser} />}
      {tab === 'requests' && <RequestsTab users={usersList.filter(isEmployee)} />}
      {tab === 'depreciation' && <DepreciationTab assets={assetsList} />}
      {tab === 'my-assets' && <MyAssetsTab assets={assetsList} users={usersList.filter(isEmployee)} />}
    </div>
  );
}
