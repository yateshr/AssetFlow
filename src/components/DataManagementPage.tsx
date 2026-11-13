import { useState } from 'react';
import { Database, Trash2, FlaskConical, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  isAdmin: boolean;
  onLoadDemoData: () => Promise<void>;
  onEraseAllData: () => Promise<void>;
}

export function DataManagementPage({ isAdmin, onLoadDemoData, onEraseAllData }: Props) {
  const [busy, setBusy] = useState<'demo' | 'erase' | null>(null);

  const run = async (kind: 'demo' | 'erase', fn: () => Promise<void>, message: string) => {
    if (!window.confirm(message)) return;
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error('Action failed', { description: e instanceof Error ? e.message : String(e) });
      setBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Administrators only</p>
        <p className="text-sm text-muted-foreground">Ask an administrator if you need to import or erase data.</p>
      </div>
    );
  }

  return (
    <div className="af-stagger space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground">Everything is stored in your own Supabase database. These tools affect all users.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Sample data</CardTitle>
            <CardDescription>Fill the workspace with example assets, users, vendors and invoices so you can explore AssetFlow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3 text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              Replaces all existing business records. Your own account is kept. Only use this on a fresh or throwaway workspace.
            </div>
            <Button
              disabled={busy !== null}
              onClick={() => run('demo', onLoadDemoData, 'Replace ALL current data with sample data? This cannot be undone.')}
            >
              {busy === 'demo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Load sample data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5" /> Erase all data</CardTitle>
            <CardDescription>Permanently delete every asset, vendor, invoice, assignment, log and setting. User accounts are kept.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => run('erase', onEraseAllData, 'Permanently delete ALL business data for everyone in this workspace? This cannot be undone.')}
            >
              {busy === 'erase' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Erase all data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
