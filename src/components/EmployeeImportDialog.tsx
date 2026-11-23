import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ConfirmHost';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  applyEmployeeImport, downloadEmployeeTemplate, downloadNotImported, duplicateRows, EMPLOYEE_TEMPLATE_HEADERS, importLog, notImported,
  planEmployeeImport, type EmployeePlan, type ImportResult, type RowAction,
} from '@/lib/employeeImport';

const TONE: Record<RowAction, string> = {
  new: 'bg-chart-2/10 text-chart-2 border-chart-2/25',
  update: 'bg-primary/10 text-primary border-primary/25',
  unchanged: 'bg-muted text-muted-foreground border-border',
  error: 'bg-destructive/10 text-destructive border-destructive/25',
};
const LABEL: Record<RowAction, string> = { new: 'New', update: 'Update', unchanged: 'No change', error: 'Not imported' };
const PREVIEW_ROWS = 200;

/** Dark console with green text, one line at a time. */
function Terminal({ lines }: { lines: string[] }) {
  return (
    <div role="log" aria-label="Import log" className="max-h-56 overflow-auto rounded-lg border border-green-500/20 bg-[#070b07] p-3 font-mono text-xs leading-relaxed text-green-400 shadow-inner">
      {lines.map((l, i) => (
        <div key={`${i}-${l}`} className={`af-line whitespace-pre-wrap break-words ${l.startsWith('$') ? 'text-green-300' : ''}`} style={{ animationDelay: `${Math.min(i, 30) * 25}ms` }}>{l}</div>
      ))}
      <span className="af-caret inline-block h-3.5 w-2 translate-y-0.5 bg-green-400" aria-hidden />
    </div>
  );
}

/** Animated progress bar. `value` is 0 to 1; without it the bar slides back and forth. */
function Progress({ value, label }: { value?: number; label: string }) {
  return (
    <div className="space-y-1.5" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === undefined ? undefined : Math.round(value * 100)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{value !== undefined && <span className="tabular-nums">{Math.round(value * 100)}%</span>}</div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        {value === undefined
          ? <div className="af-indeterminate absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary" />
          : <div className="af-progress-fill h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${Math.max(4, value * 100)}%` }} />}
      </div>
    </div>
  );
}

/** Import employees from the AssetFlow template. Only the Super Admin sees the button that opens this. */
export function EmployeeImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<EmployeePlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [createSites, setCreateSites] = useState(true);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  const reset = () => { setPlan(null); setResult(null); setError(''); setCreateSites(true); setProgress(null); setReading(false); if (input.current) input.current.value = ''; };
  const close = () => { if (busy) return; reset(); onClose(); };

  const choose = async (file?: File) => {
    if (!file) return;
    setReading(true); setError(''); setPlan(null); setResult(null);
    try {
      const planned = await planEmployeeImport(file);
      await new Promise(r => setTimeout(r, 350)); // let the reading animation be seen on small files
      if (planned.tooManyRows) setError('This file has more than 5,000 rows. Please split it into smaller files.');
      else setPlan(planned);
    } catch (e) {
      setError(e instanceof Error ? `Could not read the file: ${e.message}` : 'Could not read the file. Use an .xlsx file made from the template.');
    } finally { setReading(false); }
  };

  const counts = (plan?.rows ?? []).reduce((a, r) => ({ ...a, [r.action]: (a[r.action] || 0) + 1 }), {} as Partial<Record<RowAction, number>>);
  const skippedForSites = createSites ? 0 : (plan?.rows ?? []).filter(r => r.action !== 'error' && plan?.newSites.some(s => s.toUpperCase() === r.site.toUpperCase())).length;
  const willSave = (counts.new || 0) + (counts.update || 0) - skippedForSites;

  const run = async () => {
    if (!plan) return;
    const bad = notImported(plan);
    if (bad.length > 0) {
      const dups = duplicateRows(plan);
      const ok = await confirmDialog({
        title: dups.length ? 'Duplicate employee IDs found' : 'Some rows have problems',
        message: [
          dups.length ? `${dups.length} row${dups.length === 1 ? '' : 's'} share an employee ID with another row. An ID must belong to one employee only, so every row with a repeated ID is held back.` : '',
          `${bad.length} row${bad.length === 1 ? '' : 's'} will NOT be imported. You will get a list of them to fix and import again.`,
          `Do you still want to import the other ${willSave} employee${willSave === 1 ? '' : 's'}?`,
        ].filter(Boolean).join('\n\n'),
        confirmLabel: 'Yes, import the rest',
        cancelLabel: 'No, go back',
      });
      if (!ok) return;
    }
    setProgress({ value: 0, label: 'Starting…' });
    try {
      const r = await applyEmployeeImport(plan, { createMissingSites: createSites }, (done, total, label) => setProgress({ value: done / total, label }));
      await new Promise(res => setTimeout(res, 400)); // show 100% for a moment
      setResult(r);
      toast.success(`Employees imported: ${r.created} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} not imported` : ''}`);
    } catch (e) {
      toast.error('Import failed', { description: e instanceof Error ? e.message : String(e) });
    } finally { setProgress(null); }
  };

  const missed = plan ? notImported(plan) : [];
  const logLines = plan ? importLog(plan, result ?? undefined) : [];

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-3xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Import employees</DialogTitle>
          <DialogDescription>Download the template, fill in one row per employee, then upload it. You can review everything before anything is saved. Each employee ID (Code) must be unique.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Template columns</p>
            <p className="text-muted-foreground">{EMPLOYEE_TEMPLATE_HEADERS.join('  ·  ')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadEmployeeTemplate}><Download className="h-4 w-4" /> Download template</Button>
        </div>

        {/* Upload */}
        <label className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-6 text-center transition-colors ${reading || busy ? 'cursor-wait' : 'cursor-pointer hover:bg-primary/[0.06]'}`}>
          <Upload className={`h-6 w-6 text-primary ${reading ? 'animate-bounce' : ''}`} />
          <span className="mt-2 font-medium">{reading ? 'Reading the file…' : busy ? 'Importing…' : plan ? `Chosen: ${plan.fileName}` : 'Choose your filled template (.xlsx)'}</span>
          {!reading && !busy && plan && <span className="text-xs text-muted-foreground">Click to choose a different file</span>}
          <input ref={input} className="sr-only" type="file" accept=".xlsx,.xls" disabled={reading || busy} onChange={e => void choose(e.target.files?.[0])} />
        </label>
        {reading && <Progress label="Reading the file" />}
        {progress && <Progress value={progress.value} label={progress.label} />}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {plan && plan.missingHeaders.length > 0 && (
          <>
            <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">This file does not match the template.</p>
                <p>Missing column{plan.missingHeaders.length === 1 ? '' : 's'}: <b>{plan.missingHeaders.join(', ')}</b>. Download the template again and keep its first row unchanged.</p>
              </div>
            </div>
            <Terminal lines={logLines} />
          </>
        )}

        {plan && plan.missingHeaders.length === 0 && (
          <div className="min-w-0 space-y-4">
            {result && (
              <div className="flex items-start gap-3 rounded-lg border border-chart-2/30 bg-chart-2/5 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
                <div>
                  <p className="font-medium">Import finished</p>
                  <p className="text-muted-foreground">{result.created} added · {result.updated} updated{result.sitesCreated ? ` · ${result.sitesCreated} site${result.sitesCreated === 1 ? '' : 's'} created` : ''}{result.departmentsCreated ? ` · ${result.departmentsCreated} department${result.departmentsCreated === 1 ? '' : 's'} created` : ''}{result.skipped ? ` · ${result.skipped} not imported` : ''}</p>
                </div>
              </div>
            )}

            {!result && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(['new', 'update', 'unchanged', 'error'] as RowAction[]).filter(a => counts[a]).map(a => (
                    <Badge key={a} variant="outline" className={TONE[a]}>{counts[a]} {LABEL[a].toLowerCase()}</Badge>
                  ))}
                  {plan.rows.length === 0 && <span className="text-sm text-muted-foreground">The file has no employee rows.</span>}
                </div>

                {plan.newSites.length > 0 && (
                  <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <input type="checkbox" className="mt-1" checked={createSites} disabled={busy} onChange={e => setCreateSites(e.target.checked)} />
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
                              {r.note && <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.rows.length > PREVIEW_ROWS && <p className="border-t p-2 text-center text-xs text-muted-foreground">Showing the first {PREVIEW_ROWS} of {plan.rows.length} rows. All rows are imported.</p>}
                  </div>
                )}
              </>
            )}

            {(missed.length > 0 || result) && <Terminal lines={logLines} />}

            {/* Rows that were not imported, in the template's own format */}
            {missed.length > 0 && result && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Not imported ({missed.length})</p>
                    <p className="text-xs text-muted-foreground">Same columns as the template. Fix these rows and import them again.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadNotImported(plan)}><Download className="h-4 w-4" /> Download these rows</Button>
                </div>
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 text-left text-xs text-muted-foreground backdrop-blur">
                      <tr>{[...EMPLOYEE_TEMPLATE_HEADERS, 'Problem'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {missed.map(r => (
                        <tr key={r.line}>
                          <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.srNo || r.line}</td>
                          <td className="px-3 py-1.5 font-mono text-xs">{r.code || <i className="text-destructive">missing</i>}</td>
                          <td className="px-3 py-1.5">{r.name || <i className="text-destructive">missing</i>}</td>
                          <td className="px-3 py-1.5">{r.site || <i className="text-destructive">missing</i>}</td>
                          <td className="px-3 py-1.5">{r.department || <i className="text-destructive">missing</i>}</td>
                          <td className="px-3 py-1.5 text-xs text-destructive">{r.problems.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>Import another file</Button>
              <Button onClick={close}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button onClick={() => void run()} disabled={busy || reading || !plan || plan.missingHeaders.length > 0 || willSave <= 0}>
                <CheckCircle2 className="h-4 w-4" /> {busy ? 'Importing…' : `Import ${Math.max(0, willSave)} employee${willSave === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
