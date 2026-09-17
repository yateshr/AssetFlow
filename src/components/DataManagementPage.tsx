import { useState } from 'react';
import { Database, RotateCcw, Trash2, FlaskConical, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  onResetDemoData: () => void;
  onClearFeatureData: () => void;
}

const featureKeys = [
  'assetflow-stock',
  'assetflow-stock-movements',
  'assetflow-infrastructure',
  'assetflow-maintenance',
  'assetflow-asset-requests',
  'assetflow-device-profiles',
  'assetflow-notifications-read',
  'assetflow-archived-assets',
];

export function DataManagementPage({ onResetDemoData, onClearFeatureData }: Props) {
  const [busy, setBusy] = useState(false);

  const run = (fn: () => void, message: string) => {
    if (!window.confirm(message)) return;
    setBusy(true);
    fn();
    window.setTimeout(() => setBusy(false), 250);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demo & Data Management</h1>
        <p className="text-muted-foreground">Reset local demo data and manage browser-stored AssetFlow feature data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Demo Environment</CardTitle>
            <CardDescription>Restore the original sample records used by the local demonstration environment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Resetting demo data replaces the current in-memory users, locations, assets, assignments, invoices, vendors and audit history with the bundled sample data.
                </div>
              </div>
            </div>
            <Button disabled={busy} onClick={() => run(onResetDemoData, 'Reset the entire local demo environment to the original sample data? Current local changes will be replaced.')}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset Demo Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Local Feature Data</CardTitle>
            <CardDescription>Clear data stored in the browser by the local-only operational features.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {featureKeys.map(key => <Badge key={key} variant="outline">{key.replace('assetflow-', '')}</Badge>)}
            </div>
            <Button variant="destructive" disabled={busy} onClick={() => run(onClearFeatureData, 'Clear local feature data? This removes locally stored stock movements, requests, maintenance, infrastructure, profiles, notifications and archived assets.')}>
              <Trash2 className="h-4 w-4 mr-2" /> Clear Local Feature Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
