import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  applyEmployeeImport, downloadEmployeeTemplate, EMPLOYEE_TEMPLATE_HEADERS, planEmployeeImport, type EmployeePlan, type RowAction,
} from '@/lib/employeeImport';

const TONE: Record<RowAction, string> = {
  new: 'bg-chart-2/10 text-chart-2 border-chart-2/25',
  update: 'bg-primary/10 text-primary border-primary/25',
  unchanged: 'bg-muted text-muted-foreground border-border',
  error: 'bg-destructive/10 text-destructive border-destructive/25',
};
const LABEL: Record<RowAction, string> = { new: 'New', update: 'Update', unchanged: 'No change', error: 'Skipped' };
const PREVIEW_ROWS = 200;

/** Import employees from the AssetFlow template. Only the Super Admin sees the button that opens this. */
export function EmployeeImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<EmployeePlan | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createSites, setCreateSites] = useState(true);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setPlan(null); setError(''); setCreateSites(true); setBusy(false); setReading(false); if (input.current) input.current.value = ''; };
  const close = () => { if (busy) return; reset(); onClose(); };

  const choose = async (file?: File) => {
    if (!file) return;
    setReading(true); setError(''); setPlan(null);
    try {
      const result = await planEmployeeImport(file);
      if (result.tooManyRows) setError('This file has more than 5,000 rows. Please split it into smaller files.');
      else setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? `Could not read the file: ${e.message}` : 'Could not read the file. Use an .xlsx file made from the template.');
    } finally { setReading(false); }
  };

  const counts = (plan?.rows ?? []).reduce((a, r) => ({ ...a, [r.action]: (a[r.action] || 0) + 1 }), {} as Partial<Record<RowAction, number>>);
  const skippedForSites = createSites ? 0 : (plan?.rows ?? []).filter(r => r.action !== 'error' && plan?.newSites.some(s => s.toUpperCase() === r.site.toUpperCase())).length;
  const willSave = (counts.new || 0) + (counts.update || 0) - skippedForSites;

  const run = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await applyEmployeeImport(plan, { createMissingSites: createSites });
      const parts = [`${r.created} added`, `${r.updated} updated`];
      if (r.sitesCreated) parts.push(`${r.sitesCreated} site${r.sitesCreated === 1 ? '' : 's'} created`);
      if (r.skipped) parts.push(`${r.skipped} skipped`);
      toast.success(`Employees imported: ${parts.join(', ')}`);
      reset(); onClose();
    } catch (e) {
      toast.error('Import failed', { description: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import employees</DialogTitle>
          <DialogDescription>Download the template, fill in one row per employee, then upload it. You can review everything before anything is saved.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Template columns</p>
            <p className="text-muted-foreground">{EMPLOYEE_TEMPLATE_HEADERS.join('  ·  ')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadEmployeeTemplate}><Download className="h-4 w-4" /> Download template</Button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-6 text-center transition-colors hover:bg-primary/[0.06]">
          <Upload className="h-6 w-6 text-primary" />
          <span className="mt-2 font-medium">{reading ? 'Reading the file…' : plan ? `Chosen: ${plan.fileName}` : 'Choose your filled template (.xlsx)'}</span>
          <input ref={input} className="sr-only" type="file" accept=".xlsx,.xls" disabled={reading || busy} onChange={e => void choose(e.target.files?.[0])} />
        </label>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {plan && plan.missingHeaders.length > 0 && (
          <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">This file does not match the template.</p>
              <p>Missing column{plan.missingHeaders.length === 1 ? '' : 's'}: <b>{plan.missingHeaders.join(', ')}</b>. Download the template again and keep its first row unchanged.</p>
            </div>
          </div>
        )}

        {plan && plan.missingHeaders.length === 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['new', 'update', 'unchanged', 'error'] as RowAction[]).filter(a => counts[a]).map(a => (
                <Badge key={a} variant="outline" className={TONE[a]}>{counts[a]} {LABEL[a].toLowerCase()}</Badge>
              ))}
              {plan.rows.length === 0 && <span className="text-sm text-muted-foreground">The file has no employee rows.</span>}
            </div>

            {plan.newSites.length > 0 && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={createSites} onChange={e => setCreateSites(e.target.checked)} />
                <span>
                  <b>Create {plan.newSites.length} site{plan.newSites.length === 1 ? '' : 's'} that {plan.newSites.length === 1 ? 'does' : 'do'} not exist yet:</b> {plan.newSites.join(', ')}
                  <span className="block text-xs text-muted-foreground">Each new site gets a stock holder. Untick to skip the employees of these sites{skippedForSites ? ` (${skippedForSites} rows)` : ''}.</span>
                </span>
              </label>
            )}
            {plan.newDepartments.length > 0 && <p className="text-sm text-muted-foreground">{plan.newDepartments.length} new department{plan.newDepartments.length === 1 ? '' : 's'} will be created.</p>}

            {plan.rows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
                    <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Site</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Result</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.rows.slice(0, PREVIEW_ROWS).map(r => (
                      <tr key={r.line} className={r.action === 'error' ? 'bg-destructive/5' : ''}>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{r.code || '—'}</td>
                        <td className="px-3 py-1.5">{r.name || '—'}</td>
                        <td className="px-3 py-1.5">{r.site || '—'}</td>
                        <td className="px-3 py-1.5">{r.department || '—'}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant="outline" className={TONE[r.action]}>{LABEL[r.action]}</Badge>
                          {r.problems.length > 0 && <span className="ml-2 text-xs text-destructive">{r.problems.join('; ')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plan.rows.length > PREVIEW_ROWS && <p className="border-t p-2 text-center text-xs text-muted-foreground">Showing the first {PREVIEW_ROWS} of {plan.rows.length} rows. All rows are imported.</p>}
              </div>
            )}
            {(counts.error || 0) > 0 && <p className="text-sm text-muted-foreground">Rows marked <b>Skipped</b> will not be imported. Fix them in your file and import again, or continue without them.</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={() => void run()} disabled={busy || !plan || plan.missingHeaders.length > 0 || willSave <= 0}>
            <CheckCircle2 className="h-4 w-4" /> {busy ? 'Importing…' : `Import ${Math.max(0, willSave)} employee${willSave === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
