import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Printer, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { kv } from '@/lib/db';
import { buildPrintHtml, renderLabel, type LabelData, type LabelLayout } from '@/lib/labels';
import type { Asset, User } from '@/data/models';

const SETTINGS_KEY = 'assetflow-label-settings';

const SIZES = [
  { key: '34x22', label: '34 × 22 mm', w: 34, h: 22 },
  { key: '25x14', label: '25 × 14 mm', w: 25, h: 14 },
  { key: 'custom', label: 'Custom', w: 0, h: 0 },
] as const;

type FieldKey = 'model' | 'specs' | 'assigned' | 'warranty' | 'serial' | 'extra';

interface Settings {
  size: (typeof SIZES)[number]['key'];
  customW: number;
  customH: number;
  layout: LabelLayout;
  qrContent: 'tag' | 'link';
  fields: Record<FieldKey, boolean>;
  extra: string;
  copies: number;
  mode: 'roll' | 'sheet';
}

const DEFAULTS: Settings = {
  size: '34x22', customW: 50, customH: 30, layout: 'text', qrContent: 'tag',
  fields: { model: true, specs: false, assigned: false, warranty: true, serial: true, extra: false },
  extra: '', copies: 1, mode: 'roll',
};

const FIELD_LABELS: Record<FieldKey, string> = {
  model: 'Make & model',
  specs: 'OS / CPU / RAM / storage',
  assigned: 'Department / assigned to',
  warranty: 'Warranty period',
  serial: 'Serial number',
  extra: 'Custom line (e.g. company name)',
};

function loadSettings(): Settings {
  try {
    const raw = kv.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULTS, ...saved, fields: { ...DEFAULTS.fields, ...(saved.fields || {}) } };
    }
  } catch { /* fall back to defaults */ }
  return DEFAULTS;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(value?: string) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

type SpecRecord = { os?: string; cpu?: string; ram?: string; storage?: string };

function readSpecs(): Record<string, SpecRecord> {
  try { return JSON.parse(kv.getItem('assetflow-device-specs') || '{}'); } catch { return {}; }
}

export function buildLabelData(asset: Asset, s: Settings, users: User[], specs: Record<string, SpecRecord>): LabelData {
  const user = asset.assignedTo ? users.find(u => u.id === asset.assignedTo) : undefined;
  const lines: LabelData['lines'] = [];
  if (s.fields.model) lines.push({ key: 'model', text: [asset.manufacturer, asset.model].filter(Boolean).join(' ') || asset.name });
  if (s.fields.specs) {
    const spec = specs[asset.id];
    if (spec?.os) lines.push({ key: 'spec-os', text: spec.os });
    const hw = [spec?.cpu, spec?.storage && spec?.ram ? `${spec.storage} / ${spec.ram}` : spec?.storage || spec?.ram].filter(Boolean).join(', ');
    if (hw) lines.push({ key: 'spec-hw', text: hw });
  }
  if (s.fields.assigned && user) lines.push({ key: 'assigned', text: user.department ? `${user.department} - ${user.name}` : user.name });
  if (s.fields.extra && s.extra.trim()) lines.push({ key: 'extra', text: s.extra.trim() });
  if (s.fields.warranty) {
    const from = shortDate(asset.purchaseDate);
    const to = shortDate(asset.warrantyExpiry);
    if (from && to) lines.push({ key: 'warranty', text: `${from} to ${to}` });
    else if (to) lines.push({ key: 'warranty', text: `Warranty till ${to}` });
  }
  if (s.fields.serial && asset.serialNumber) lines.push({ key: 'serial', text: `S/N: ${asset.serialNumber}` });
  const tag = asset.assetTag || asset.id;
  const code = s.qrContent === 'link' && typeof window !== 'undefined'
    ? `${window.location.origin}/?asset=${encodeURIComponent(tag)}`
    : tag;
  return { tag, lines, code };
}

interface Props {
  assets: Asset[];
  /** Assets to select when the dialog opens. */
  initialSelection: Asset[];
  users: User[];
  onClose: () => void;
}

export function LabelPrintDialog({ assets, initialSelection, users, onClose }: Props) {
  const [s, setS] = useState<Settings>(loadSettings);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection.map(a => a.id)));
  const [query, setQuery] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const specs = useMemo(readSpecs, []);

  useEffect(() => {
    const t = setTimeout(() => kv.setItem(SETTINGS_KEY, JSON.stringify(s)), 400);
    return () => clearTimeout(t);
  }, [s]);

  const preset = SIZES.find(x => x.key === s.size)!;
  const W = s.size === 'custom' ? Math.min(150, Math.max(15, s.customW || 34)) : preset.w;
  const H = s.size === 'custom' ? Math.min(100, Math.max(8, s.customH || 22)) : preset.h;

  const chosen = useMemo(() => assets.filter(a => selected.has(a.id)), [assets, selected]);

  const rendered = useMemo(
    () => chosen.map(a => ({ asset: a, ...renderLabel(buildLabelData(a, s, users, specs), { widthMm: W, heightMm: H, layout: s.layout, border: true }) })),
    [chosen, s, users, specs, W, H]
  );

  const shown = assets.filter(a => {
    const q = query.trim().toLowerCase();
    return !q || `${a.assetTag} ${a.name} ${a.model} ${a.serialNumber}`.toLowerCase().includes(q);
  });

  const warnings: string[] = Array.from(new Set<string>(rendered.flatMap(r => r.warnings))).slice(0, 4);
  const total = rendered.length * Math.max(1, s.copies);

  const patch = (p: Partial<Settings>) => setS(prev => ({ ...prev, ...p }));
  const toggleField = (k: FieldKey) => setS(prev => ({ ...prev, fields: { ...prev.fields, [k]: !prev.fields[k] } }));
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const print = () => {
    const copies = Math.max(1, Math.min(20, s.copies));
    const svgs = rendered.flatMap(r => Array.from({ length: copies }, () => r.svg));
    const frame = frameRef.current;
    if (!frame || !svgs.length) return;
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(buildPrintHtml(svgs, W, H, s.mode));
    doc.close();
    setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); }, 150);
  };

  const select = 'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm transition-colors ${active ? 'border-primary bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="!max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Print asset labels</DialogTitle>
          <DialogDescription>Choose the sticker size and what to show. The preview is drawn to real size.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">Sticker size</p>
              <div className="flex flex-wrap gap-2">
                {SIZES.map(x => <button key={x.key} type="button" className={chip(s.size === x.key)} onClick={() => patch({ size: x.key })}>{x.label}</button>)}
              </div>
              {s.size === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <Input type="number" min={15} max={150} value={s.customW} onChange={e => patch({ customW: Number(e.target.value) })} aria-label="Width in mm" />
                  <span className="text-muted-foreground">×</span>
                  <Input type="number" min={8} max={100} value={s.customH} onChange={e => patch({ customH: Number(e.target.value) })} aria-label="Height in mm" />
                  <span className="text-sm text-muted-foreground">mm</span>
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">Layout</p>
              <div className="flex flex-wrap gap-2">
                {([['text', 'Text only'], ['qr', 'With QR code'], ['barcode', 'Barcode (needs wide labels)']] as const).map(([k, label]) =>
                  <button key={k} type="button" className={chip(s.layout === k)} onClick={() => patch({ layout: k })}>{label}</button>)}
              </div>
              {s.layout === 'qr' && (
                <select className={`${select} mt-2`} value={s.qrContent} onChange={e => patch({ qrContent: e.target.value as Settings['qrContent'] })}>
                  <option value="tag">QR contains: asset tag (works offline)</option>
                  <option value="link">QR contains: link that opens the asset</option>
                </select>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">Show on label</p>
              <div className="space-y-1.5">
                {(Object.keys(FIELD_LABELS) as FieldKey[]).map(k => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-[var(--primary)]" checked={s.fields[k]} onChange={() => toggleField(k)} />
                    {FIELD_LABELS[k]}
                  </label>
                ))}
              </div>
              {s.fields.extra && <Input className="mt-2" placeholder="e.g. InfoSpace Solution - Design Dept." value={s.extra} onChange={e => patch({ extra: e.target.value })} />}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-sm font-medium">Copies each</p>
                <Input type="number" min={1} max={20} value={s.copies} onChange={e => patch({ copies: Number(e.target.value) })} />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Printing on</p>
                <select className={select} value={s.mode} onChange={e => patch({ mode: e.target.value as Settings['mode'] })}>
                  <option value="roll">Label roll (1 per page)</option>
                  <option value="sheet">A4 sticker sheet</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preview + asset picker */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-3 text-xs text-muted-foreground">Preview ({rendered.length} asset{rendered.length === 1 ? '' : 's'}, showing up to 8)</p>
              {rendered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Select at least one asset below.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {rendered.slice(0, 8).map(r => (
                    <div key={r.asset.id} className="shadow-sm ring-1 ring-black/10" style={{ width: `${W * 4.2}px`, height: `${H * 4.2}px`, background: '#fff' }}
                      dangerouslySetInnerHTML={{ __html: r.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%"') }} />
                  ))}
                </div>
              )}
              {warnings.map(w => (
                <p key={w} className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />{w}</p>
              ))}
            </div>

            <div className="rounded-xl border">
              <div className="flex items-center gap-2 border-b p-2">
                <Search className="ml-1 h-4 w-4 text-muted-foreground" />
                <Input className="h-8 border-0 shadow-none focus-visible:ring-0" placeholder="Search assets to add or remove…" value={query} onChange={e => setQuery(e.target.value)} />
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set([...selected, ...shown.map(a => a.id)]))}>Select shown</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {shown.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No assets found.</p>}
                {shown.slice(0, 300).map(a => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60">
                    <input type="checkbox" className="accent-[var(--primary)]" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                    <span className="font-mono text-xs">{a.assetTag}</span>
                    <span className="truncate text-muted-foreground">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">{total} label{total === 1 ? '' : 's'} · {W} × {H} mm · {s.mode === 'roll' ? 'one per page' : 'A4 sheet'}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={print} disabled={total === 0}><Printer className="h-4 w-4" /> Print {total} label{total === 1 ? '' : 's'}</Button>
          </div>
        </div>
        <iframe ref={frameRef} title="label-print" className="absolute h-0 w-0 border-0" aria-hidden="true" />
      </DialogContent>
    </Dialog>
  );
}
