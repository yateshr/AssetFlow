import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Copy, Plus, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DEFAULT_ASSET_CATEGORIES } from '@/data/assetCategories';
import type { Asset, AssetCategory, Location } from '@/data/models';
import { getCollection, kv, loadAssetTagSiteSeries, saveAssetTagSiteSeries, setAssetTagFormat, useCollection, type AssetTagSiteSeries, type TagSeparator } from '@/lib/db';

const clean = (v: string, max: number) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'type';
const lower = (v: string) => v.trim().toLowerCase();

/** All assets of the company, including archived ones (their tags are still taken). */
function allAssets(): Asset[] {
  let archived: Asset[] = [];
  try { archived = JSON.parse(kv.getItem('assetflow-archived-assets') || '[]'); } catch { /* ignore */ }
  return [...getCollection<Asset>('assets'), ...archived];
}

/* ───────────────────────── page ───────────────────────── */

export function AssetSetupPanel() {
  return (
    <div className="space-y-6">
      <AssetTypes />
      <NumberingBySite />
    </div>
  );
}

/* ───────────────────────── step 1: asset types ───────────────────────── */

function AssetTypes() {
  const [types, setTypes] = useCollection<AssetCategory>('asset-categories');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<AssetCategory | null>(null);
  const assets = useMemo(allAssets, [types]);
  const usage = (t: AssetCategory) => assets.filter(a => a.type === t.id).length;

  const codeTaken = (code: string, exceptId?: string) => types.some(t => t.id !== exceptId && (t.code || '').toUpperCase() === code.toUpperCase());
  const suggest = (label: string) => {
    const letters = clean(label, 12).replace(/[0-9]/g, '');
    const base = (letters.slice(0, 3) || 'TYP').padEnd(3, 'X');
    if (!codeTaken(base)) return base;
    for (let n = 2; n < 100; n++) { const c = `${base.slice(0, 2)}${n}`; if (!codeTaken(c)) return c; }
    return base;
  };

  const add = () => {
    const label = name.trim();
    if (!label) { setError('Enter a name, for example “Laptop”.'); return; }
    if (types.some(t => lower(t.name) === lower(label))) { setError(`“${label}” already exists.`); return; }
    let id = slug(label);
    for (let n = 2; types.some(t => t.id === id); n++) id = `${slug(label)}-${n}`;
    setTypes([...types, { id, name: label, code: suggest(label), active: true }]);
    setName(''); setError('');
  };
  const patch = (id: string, change: Partial<AssetCategory>) => setTypes(types.map(t => (t.id === id ? { ...t, ...change } : t)));
  const missingCodes = types.filter(t => t.active && !(t.code || '').trim()).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Step 1 · Asset types</CardTitle>
        <CardDescription>
          The kinds of things you track. Each type has a short <b>code</b> that goes into the asset tag, for example <span className="font-mono">LAP</span> in <span className="font-mono">NP-IT-LAP-A0001</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
          <Input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="New asset type, e.g. Router" aria-label="New asset type name" aria-invalid={!!error} />
          <Button type="submit"><Plus className="h-4 w-4" /> Add</Button>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {missingCodes > 0 && <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"><AlertTriangle className="h-4 w-4" /> {missingCodes} type{missingCodes === 1 ? ' has' : 's have'} no code, so tags will use the full name. Give each one a short code.</p>}

        {types.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No asset types yet.</p>
            <Button className="mt-3" variant="outline" onClick={() => setTypes(DEFAULT_ASSET_CATEGORIES)}>Add starter types (Laptop, Desktop, Monitor…)</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y">
              {types.map(t => {
                const used = usage(t);
                return (
                  <li key={t.id} className={`flex flex-wrap items-start gap-2 p-2.5 ${t.active ? '' : 'bg-muted/40'}`}>
                    <div className="min-w-[10rem] flex-1"><TextCell value={t.name} aria-label="Type name" onCommit={v => (types.some(x => x.id !== t.id && lower(x.name) === lower(v)) ? `“${v}” already exists.` : (patch(t.id, { name: v }), ''))} /></div>
                    <div className="w-28"><TextCell value={t.code || ''} mono transform={v => clean(v, 6)} aria-label={`Code for ${t.name}`} placeholder="Code"
                      onCommit={v => (!v ? 'Code cannot be blank.' : codeTaken(v, t.id) ? `Code ${v} is used by another type.` : (patch(t.id, { code: v }), ''))} /></div>
                    <span className="flex h-8 items-center"><Badge variant={used ? 'secondary' : 'outline'} className="text-[11px]">{used ? `${used} in use` : 'unused'}</Badge></span>
                    <span className="ml-auto flex items-center justify-end gap-1">
                      {t.active
                        ? <Button size="sm" variant="ghost" onClick={() => patch(t.id, { active: false })} title="Hide from new assets"><Archive className="h-4 w-4" /> Archive</Button>
                        : <Button size="sm" variant="ghost" onClick={() => patch(t.id, { active: true })}><Undo2 className="h-4 w-4" /> Restore</Button>}
                      <Button size="icon-sm" variant="ghost" disabled={used > 0} onClick={() => setToDelete(t)} aria-label={`Delete ${t.name}`} title={used > 0 ? 'In use — archive it instead' : 'Delete'}><Trash2 className={`h-4 w-4 ${used > 0 ? '' : 'text-destructive'}`} /></Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!toDelete} onOpenChange={open => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>No asset uses this type, so nothing else is affected. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) setTypes(types.filter(t => t.id !== toDelete.id)); setToDelete(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Text box that saves on blur or Enter; `onCommit` returns an error message (or '' when saved). */
function TextCell({ value, onCommit, transform, mono, placeholder, ...rest }: { value: string; onCommit: (v: string) => string; transform?: (v: string) => string; mono?: boolean; placeholder?: string; 'aria-label'?: string }) {
  const [text, setText] = useState(value);
  const [bad, setBad] = useState('');
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const next = (transform ? transform(text) : text).trim();
    if (next === value) { setText(value); setBad(''); return; }
    const err = onCommit(next);
    if (err) { setBad(err); setText(value); } else setBad('');
  };
  return (
    <div>
      <Input className={`h-8 ${mono ? 'font-mono uppercase' : ''}`} value={text} placeholder={placeholder} aria-invalid={!!bad} {...rest}
        onChange={e => setText(transform ? transform(e.target.value) : e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      {bad && <p role="alert" className="mt-0.5 text-xs text-destructive">{bad}</p>}
    </div>
  );
}

/* ───────────────────────── step 2: numbering per site ───────────────────────── */

type Draft = Omit<AssetTagSiteSeries, 'id'> & { id?: string };
const pad = (n: number, digits: number) => String(n).padStart(digits, '0');
const tagOf = (d: Draft, typeCode: string, n = d.nextNumber) => [d.companyPrefix, d.useFunctionPrefix ? d.functionPrefix : '', typeCode, `${d.series}${pad(n, d.digits)}`].filter(Boolean).join(d.separator);

const SEPARATORS: Array<{ value: TagSeparator; label: string }> = [
  { value: '-', label: 'Hyphen  -' },
  { value: '.', label: 'Dot  .' },
  { value: '_', label: 'Underscore  _' },
  { value: '/', label: 'Slash  /' },
  { value: '', label: 'None (no separator)' },
];

function NumberingBySite() {
  const [sites] = useCollection<Location>('locations');
  const [types] = useCollection<AssetCategory>('asset-categories');
  const [rules, setRules] = useState<AssetTagSiteSeries[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [siteId, setSiteId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => loadAssetTagSiteSeries().then(setRules).catch(e => setLoadError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (!siteId && sites[0]) setSiteId(sites[0].id); }, [sites, siteId]);

  const ruleFor = (id: string) => rules?.find(r => r.siteId === id);
  const saved = siteId ? ruleFor(siteId) : undefined;

  // Series letter nobody with the same prefixes uses yet.
  const suggestSeries = (company: string, fn: string) => {
    const used = new Set((rules || []).filter(r => r.companyPrefix === company && r.functionPrefix === fn).map(r => r.series.toUpperCase()));
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(l => !used.has(l)) || '';
  };

  useEffect(() => {
    if (!siteId || !rules) { setDraft(null); return; }
    const existing = rules.find(r => r.siteId === siteId);
    if (existing) { setDraft({ ...existing }); return; }
    const base = rules[0];
    const company = base?.companyPrefix || '';
    const fn = base?.functionPrefix || 'IT';
    setDraft({ siteId, companyPrefix: company, functionPrefix: fn, series: suggestSeries(company, fn), nextNumber: 1, digits: base?.digits || 4, active: true, separator: base?.separator ?? '-', useFunctionPrefix: base?.useFunctionPrefix ?? true });
  }, [siteId, rules]);

  const site = sites.find(s => s.id === siteId);
  const sampleCodes = useMemo(() => {
    const codes = types.filter(t => t.active).map(t => (t.code || t.name || '').toUpperCase()).filter(Boolean).slice(0, 3);
    return codes.length ? codes : ['LAP', 'MON', 'PRN'];
  }, [types]);

  const problems = useMemo(() => {
    if (!draft) return [] as string[];
    const out: string[] = [];
    if (!draft.companyPrefix) out.push('Enter a company prefix, for example NP.');
    if (draft.useFunctionPrefix && !draft.functionPrefix) out.push('Enter a department code, for example IT, or turn the department code off in Tag format.');
    if (draft.nextNumber < 1) out.push('Next number must be 1 or more.');
    if (draft.digits < 1 || draft.digits > 8) out.push('Digits must be between 1 and 8.');
    if (String(draft.nextNumber).length > draft.digits) out.push(`Number ${draft.nextNumber} needs more than ${draft.digits} digits.`);
    // Collisions with assets that already carry this series at this site.
    const head = draft.companyPrefix;
    let highest = 0;
    for (const a of allAssets()) {
      if (a.siteId !== draft.siteId || !a.assetTag?.toUpperCase().startsWith(head)) continue;
      const m = a.assetTag.toUpperCase().match(new RegExp(`-${draft.series}(\\d+)$`));
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    if (highest >= draft.nextNumber && draft.companyPrefix) out.push(`Assets at this site already use up to ${draft.series}${pad(highest, draft.digits)}. Next number must be at least ${highest + 1}.`);
    // Same prefixes and series used at another site would hand out duplicate tags.
    const clash = (rules || []).find(r => r.siteId !== draft.siteId && r.active && draft.active && r.companyPrefix === draft.companyPrefix && (!draft.useFunctionPrefix || r.functionPrefix === draft.functionPrefix) && r.series === draft.series);
    if (clash) out.push(`${sites.find(s => s.id === clash.siteId)?.name || 'Another site'} already uses series “${draft.series || '(none)'}” with these prefixes. Choose a different series letter.`);
    return out;
  }, [draft, rules, sites]);

  const dirty = !!draft && JSON.stringify({ ...draft, id: undefined }) !== JSON.stringify(saved ? { ...saved, id: undefined } : null);
  const set = (patch: Partial<Draft>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const copyFrom = (otherSiteId: string) => {
    const src = ruleFor(otherSiteId);
    if (!src || !draft) return;
    set({ companyPrefix: src.companyPrefix, functionPrefix: src.functionPrefix, digits: src.digits, series: suggestSeries(src.companyPrefix, src.functionPrefix), nextNumber: 1 });
  };

  const save = async () => {
    if (!draft || problems.length) return;
    setSaving(true);
    try {
      await saveAssetTagSiteSeries({ ...draft, id: draft.id || crypto.randomUUID() } as AssetTagSiteSeries);
      await reload();
      toast.success(`Numbering saved for ${site?.name || 'site'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save numbering');
    } finally { setSaving(false); }
  };

  if (sites.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Step 2 · Numbering by site</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Create a site first (Sites in the left menu), then come back to set its numbering.</p></CardContent>
      </Card>
    );
  }

  const setUp = (id: string) => { const r = ruleFor(id); return r ? (r.active ? 'ready' : 'paused') : 'missing'; };
  const missing = sites.filter(s => setUp(s.id) === 'missing').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Step 2 · Numbering by site</CardTitle>
        <CardDescription>
          Each site gets its own tag pattern and counter. Every asset created at a site takes the next number, whatever its type, so numbers never repeat.
        </CardDescription>
        {missing > 0 && <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"><AlertTriangle className="h-4 w-4" /> {missing} site{missing === 1 ? ' is' : 's are'} not set up. Assets cannot be added there until you do.</p>}
      </CardHeader>
      <CardContent>
        {loadError && <p role="alert" className="mb-3 text-sm text-destructive">{loadError}</p>}
        {rules && <TagFormat rules={rules} sampleCode={sampleCodes[0]} onSaved={reload} />}
        <div className="space-y-4">
          <ul className="flex flex-wrap gap-2" aria-label="Sites">
            {sites.map(s => {
              const st = setUp(s.id);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setSiteId(s.id)} aria-current={siteId === s.id ? 'true' : undefined}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${siteId === s.id ? 'border-primary/50 bg-primary/10' : 'hover:bg-muted'}`}>
                    <span className="truncate font-medium">{s.name}</span>
                    {st === 'ready' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-chart-2" aria-label="Set up" /> : <Badge variant="outline" className="shrink-0 text-[10px]">{st === 'paused' ? 'Paused' : 'Not set up'}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>

          {draft && (
            <div className="min-w-0 space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold">{site?.name}</h4>
                {(rules || []).filter(r => r.siteId !== siteId).length > 0 && !saved && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground"><Copy className="h-3.5 w-3.5" /> Copy prefixes and digits from
                    <select className="h-8 rounded-md border bg-background px-2 text-xs" value="" onChange={e => e.target.value && copyFrom(e.target.value)}>
                      <option value="">choose a site…</option>
                      {(rules || []).filter(r => r.siteId !== siteId).map(r => <option key={r.siteId} value={r.siteId}>{sites.find(s => s.id === r.siteId)?.name || r.siteId}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Next asset tags at this site</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {sampleCodes.map((code, i) => <span key={code} className="rounded-md border bg-background px-2.5 py-1 font-mono text-sm font-semibold">{tagOf(draft, code, draft.nextNumber + i)}</span>)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-mono">{draft.companyPrefix || 'COMPANY'}</span> · {draft.useFunctionPrefix && <><span className="font-mono">{draft.functionPrefix || 'DEPT'}</span> · </>}<span className="font-mono">TYPE</span> · <span className="font-mono">{draft.series}{pad(draft.nextNumber, draft.digits)}</span>
                </p>
              </div>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
                <Labeled label="Company prefix" help="Short code for the company, e.g. NP">
                  <Input value={draft.companyPrefix} onChange={e => set({ companyPrefix: clean(e.target.value, 6) })} className="font-mono uppercase" />
                </Labeled>
                {draft.useFunctionPrefix && (
                  <Labeled label="Department code" help="The department that issues the tag, e.g. IT">
                    <Input value={draft.functionPrefix} onChange={e => set({ functionPrefix: clean(e.target.value, 6) })} className="font-mono uppercase" />
                  </Labeled>
                )}
                <Labeled label="Series letter" help="Keeps sites apart, e.g. A for Head Office, B for Plant">
                  <Input value={draft.series} onChange={e => set({ series: clean(e.target.value, 3) })} className="font-mono uppercase" />
                </Labeled>
                <Labeled label="Number of digits" help="4 gives 0001 to 9999">
                  <Input type="number" min={1} max={8} value={draft.digits} onChange={e => set({ digits: Math.min(8, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
                </Labeled>
                <Labeled label="Next number" help={saved ? 'Counter moves up by itself. Only change it to skip ahead.' : 'Where counting starts'}>
                  <Input type="number" min={1} value={draft.nextNumber} onChange={e => set({ nextNumber: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                </Labeled>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /> Active <span className="text-xs text-muted-foreground">(untick to stop issuing tags here)</span>
                </label>
              </div>

              {problems.length > 0 && (
                <ul role="alert" className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {problems.map(p => <li key={p} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{p}</li>)}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={save} disabled={!dirty || problems.length > 0 || saving}>{saving ? 'Saving…' : saved ? 'Save changes' : 'Set up this site'}</Button>
                {dirty && saved && <Button variant="ghost" onClick={() => setDraft({ ...saved })}>Discard</Button>}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Labeled({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}{children}<span className="block text-xs font-normal text-muted-foreground">{help}</span></label>;
}

/** Company-wide tag format: separator between the parts and whether the department code is used. */
function TagFormat({ rules, sampleCode, onSaved }: { rules: AssetTagSiteSeries[]; sampleCode: string; onSaved: () => void }) {
  const current = rules[0];
  const [separator, setSeparator] = useState<TagSeparator>(current?.separator ?? '-');
  const [useFn, setUseFn] = useState(current?.useFunctionPrefix ?? true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (current) { setSeparator(current.separator); setUseFn(current.useFunctionPrefix); } }, [current?.separator, current?.useFunctionPrefix]);

  const changed = !!current && (separator !== current.separator || useFn !== current.useFunctionPrefix);
  const existing = useMemo(() => allAssets().filter(a => a.assetTag).length, [rules]);
  const example = [current?.companyPrefix || 'NP', useFn ? current?.functionPrefix || 'IT' : '', sampleCode || 'LAP', `${current?.series || 'A'}${pad(1, current?.digits || 4)}`].filter(Boolean).join(separator);

  const save = async () => {
    setSaving(true);
    try {
      const n = await setAssetTagFormat(separator, useFn);
      toast.success(`Tag format saved for ${n} site${n === 1 ? '' : 's'}`);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save the tag format'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mb-4 space-y-3 rounded-lg border bg-muted/20 p-4">
      <div>
        <h4 className="font-semibold">Tag format <span className="text-xs font-normal text-muted-foreground">(applies to every site)</span></h4>
        <p className="text-xs text-muted-foreground">How the parts of an asset tag are joined.</p>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        <label className="block space-y-1.5 text-sm font-medium">Separator
          <select disabled={!current} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal disabled:opacity-60" value={separator} onChange={e => setSeparator(e.target.value as TagSeparator)}>
            {SEPARATORS.map(s => <option key={s.label} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" disabled={!current} checked={useFn} onChange={e => setUseFn(e.target.checked)} /> Include department code <span className="text-xs text-muted-foreground">(like IT)</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">Example</span>
        <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-sm font-semibold">{example}</span>
        {separator === '' && <span className="text-xs text-amber-600 dark:text-amber-400">Harder to read without a separator.</span>}
        {separator === '/' && <span className="text-xs text-muted-foreground">Slashes work, but avoid them if tags are used in file names.</span>}
      </div>
      {changed && existing > 0 && (
        <p className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {existing} asset{existing === 1 ? ' already has' : 's already have'} a tag. Their tags stay exactly as they are (they may already be printed); only new assets use the new format.</p>
      )}
      {current ? (
        <Button size="sm" onClick={save} disabled={!changed || saving}>{saving ? 'Saving…' : 'Save tag format'}</Button>
      ) : (
        <p className="text-xs text-muted-foreground">Set up your first site below (it starts with a hyphen and the department code). You can change the format here afterwards and it will apply to every site.</p>
      )}
    </div>
  );
}
