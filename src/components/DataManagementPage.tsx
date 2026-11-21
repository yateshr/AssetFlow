import { useState } from 'react';
import { Database, Trash2, FlaskConical, AlertTriangle, ShieldAlert, Upload, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkbookImport } from '@/lib/workbookImport';
import { ActivityIndicator } from '@/components/ui/loading';
import { getCollection } from '@/lib/db';

interface Props {
  isAdmin: boolean;
  onLoadDemoData: () => Promise<void>;
  onEraseAllData: () => Promise<void>;
}

export function DataManagementPage({ isAdmin, onLoadDemoData, onEraseAllData }: Props) {
  const [busy, setBusy] = useState<'demo' | 'erase' | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [preview, setPreview] = useState<WorkbookImport | null>(null);

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

  const inspectFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImportBusy(true);
    setPreview(null);
    try {
      const { parseAssetWorkbooks } = await import('@/lib/workbookImport');
      const parsed = await parseAssetWorkbooks(Array.from(files));
      if (!parsed.assets.length && !parsed.users.length && !parsed.callLogs.length && !parsed.invoices.length) throw new Error('No supported AssetFlow sheets were found. Select the Asset Register or PC Log Book workbook.');
      setPreview(parsed);
      toast.success('Workbook analysis complete', { description: 'Review the counts and warnings before importing.' });
    } catch (e) {
      toast.error('Could not read workbook', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setImportBusy(false);
    }
  };

  const importPreview = async () => {
    if (!preview || !window.confirm('Import these reviewed records into AssetFlow? Existing records with the same IDs will be updated.')) return;
    setImportBusy(true);
    try {
      const { applyWorkbookImport } = await import('@/lib/workbookImport');
      await applyWorkbookImport(preview);
      toast.success('Workbook imported successfully');
      window.location.reload();
    } catch (e) {
      toast.error('Import failed', { description: e instanceof Error ? e.message : String(e) });
      setImportBusy(false);
    }
  };

  const downloadBackup = () => {
    const collections=['users','locations','departments','vendors','asset-categories','assets','invoices','assignments','history','call-logs','licenses','audit-logs'];
    const backup={version:1,createdAt:new Date().toISOString(),collections:Object.fromEntries(collections.map(name=>[name,getCollection(name)]))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download=`assetflow-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
    toast.success('Backup downloaded');
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
            <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Workspace backup</CardTitle>
            <CardDescription>Download a portable JSON snapshot before upgrades, bulk imports, or data changes.</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" onClick={downloadBackup}><Download className="h-4 w-4" /> Download backup</Button></CardContent>
        </Card>
        <Card className="lg:col-span-2 border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Import IT asset workbooks</CardTitle>
            <CardDescription>Import the Asset Register and PC Log Book together. Files are analyzed locally first; nothing is saved until you confirm the preview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-6 text-center transition-colors hover:bg-primary/[0.06]">
              {importBusy ? <ActivityIndicator className="text-primary" label="Analyzing workbooks" /> : <Upload className="h-7 w-7 text-primary" />}
              <span className="mt-2 font-medium">Select Excel workbooks</span>
              <span className="mt-1 text-xs text-muted-foreground">Choose both .xlsx files together for the most complete import</span>
              <input className="sr-only" type="file" accept=".xlsx,.xls" multiple disabled={importBusy} onChange={(event) => void inspectFiles(event.target.files)} />
            </label>

            {preview && <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/25 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
                <div><p className="font-medium">Ready to import {preview.files.length} workbook{preview.files.length === 1 ? '' : 's'}</p><p className="text-sm text-muted-foreground">{preview.files.join(', ')}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  ['Physical assets', preview.assets.length], ['Users', preview.users.length], ['Assignments', preview.assignments.length],
                  ['History events', preview.history.length], ['Accounts/licenses', preview.licenses.length], ['Call logs', preview.callLogs.length],
                  ['Locations', preview.locations.length], ['Departments', preview.departments.length], ['Vendors', preview.vendors.length],
                  ['Invoices', preview.invoices.length], ['Spare items', preview.stock.length],
                ].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-background p-3"><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
              </div>
              {preview.warnings.length > 0 && <div className="space-y-2">
                {preview.warnings.map(warning => <div key={warning.code} className="flex gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>{warning.message} <strong>({warning.count})</strong></span></div>)}
              </div>}
              <div className="flex justify-end"><Button disabled={importBusy} onClick={() => void importPreview()}>{importBusy ? <ActivityIndicator label="Importing data" /> : <Database className="h-4 w-4" />} Import reviewed data</Button></div>
            </div>}
          </CardContent>
        </Card>

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
              {busy === 'demo' ? <ActivityIndicator label="Loading sample data" /> : <Database className="h-4 w-4" />} Load sample data
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
              {busy === 'erase' ? <ActivityIndicator label="Erasing data" /> : <Trash2 className="h-4 w-4" />} Erase all data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
