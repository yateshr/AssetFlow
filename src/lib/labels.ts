/**
 * Asset label engine. Lays out one label in real millimetres and returns SVG,
 * so the preview, the printed label and any size (34x22, 25x14, custom) all
 * come from the same code. Text is shrunk to fit; lines that cannot stay
 * legible are dropped and reported instead of being printed unreadably.
 */
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export type LabelLayout = 'text' | 'qr' | 'barcode';

export interface LabelOptions {
  widthMm: number;
  heightMm: number;
  layout: LabelLayout;
  border: boolean;
}

export interface LabelData {
  tag: string;
  /** Extra lines in priority order; the first ones are dropped last. */
  lines: { key: string; text: string }[];
  /** What the QR code / barcode encodes. */
  code: string;
}

export interface RenderedLabel {
  svg: string;
  warnings: string[];
}

const MIN_FONT_MM = 1.25; // ~3.5pt: below this a thermal label is not legible
const MIN_QR_MODULE_MM = 0.27;
const MIN_BAR_MODULE_MM = 0.19;

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Width of `text` in em for the label font (bold or regular). */
function widthEm(text: string, bold: boolean): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!measureCtx) return text.length * (bold ? 0.62 : 0.56);
  measureCtx.font = `${bold ? 'bold ' : ''}100px Arial, Helvetica, sans-serif`;
  return measureCtx.measureText(text).width / 100;
}

function fit(text: string, bold: boolean, maxSize: number, maxWidth: number) {
  const em = widthEm(text, bold) || 0.5;
  return Math.min(maxSize, maxWidth / em);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => Number(n.toFixed(3));

function qrPath(value: string, x: number, y: number, size: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 1;
  const unit = size / (n + quiet * 2);
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) { c++; continue; }
      const start = c;
      while (c < n && qr.modules.get(r, c)) c++;
      d += `M${num(x + (start + quiet) * unit)} ${num(y + (r + quiet) * unit)}h${num((c - start) * unit)}v${num(unit)}h${num(-(c - start) * unit)}z`;
    }
  }
  return { d, module: unit };
}

function barcodeBars(value: string): { bars: { x: number; w: number }[]; total: number } | null {
  if (typeof document === 'undefined') return null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, { format: 'CODE128', displayValue: false, margin: 0, width: 1, height: 10 });
  const total = parseFloat(svg.getAttribute('width') || '0');
  const bars = Array.from(svg.querySelectorAll('rect'))
    .filter(r => !(r.getAttribute('width') || '').includes('%'))
    .map(r => ({ x: parseFloat(r.getAttribute('x') || '0'), w: parseFloat(r.getAttribute('width') || '0') }));
  return total > 0 && bars.length ? { bars, total } : null;
}

export function renderLabel(data: LabelData, o: LabelOptions): RenderedLabel {
  const warnings: string[] = [];
  const W = o.widthMm;
  const H = o.heightMm;
  const s = Math.max(0.55, Math.min(W / 34, H / 22, 2));
  const stroke = Math.max(0.18, 0.32 * s);
  const pad = Math.max(0.45, 0.9 * s);
  const inset = stroke / 2 + 0.12;

  const bx = inset;
  const by = inset;
  const bw = W - inset * 2;
  const bh = H - inset * 2;
  const ix = bx + stroke / 2 + pad;
  const iy = by + stroke / 2 + pad;
  const iw = bw - stroke - pad * 2;
  const ih = bh - stroke - pad * 2;

  let textX = ix, textY = iy, textW = iw, textH = ih;
  let art = '';

  let tagBox: { x: number; y: number; w: number; h: number } | null = null;

  if (o.layout === 'qr') {
    // Tag across the full width on top; QR at the bottom-right, details to its left.
    const tagH = ih * 0.3;
    const gap = Math.max(0.4, 0.7 * s);
    const restH = ih - tagH;
    const size = Math.min(restH, iw * 0.45);
    const { d, module } = qrPath(data.code, ix + iw - size, iy + ih - size, size);
    art += `<path d="${d}" fill="#000"/>`;
    tagBox ={ x: ix, y: iy, w: iw, h: tagH };
    textY = iy + tagH;
    textH = restH;
    textW = iw - size - gap;
    if (module < MIN_QR_MODULE_MM) warnings.push(`QR modules are ${module.toFixed(2)} mm: may be hard to scan. Use a bigger label, “Asset tag” as QR content, or the text-only layout.`);
  } else if (o.layout === 'barcode') {
    const enc = barcodeBars(data.code);
    const barH = Math.max(2, ih * 0.34);
    const gap = Math.max(0.4, 0.6 * s);
    if (enc) {
      const scale = iw / enc.total;
      const by0 = iy + ih - barH;
      art += `<g fill="#000">${enc.bars.map(b => `<rect x="${num(ix + b.x * scale)}" y="${num(by0)}" width="${num(b.w * scale)}" height="${num(barH)}"/>`).join('')}</g>`;
      if (scale < MIN_BAR_MODULE_MM) warnings.push(`Barcode bars are ${scale.toFixed(2)} mm: too fine for most scanners. Use the QR layout or a wider label.`);
    }
    textH = ih - barH - gap;
  }

  // Text lines: the tag is the largest; extras drop out (lowest priority first) if they cannot stay legible.
  type Line = { text: string; bold: boolean; weight: number; key: string };
  let lines: Line[] = [
    ...(tagBox ? [] : [{ text: data.tag, bold: true, weight: 1.6, key: 'tag' }]),
    ...data.lines.filter(l => l.text.trim()).map(l => ({ text: l.text.trim(), bold: true, weight: l.key === 'serial' ? 0.85 : 1, key: l.key })),
  ];

  const sizes = (ls: Line[]) => {
    const sum = ls.reduce((a, l) => a + l.weight, 0);
    return ls.map(l => {
      const slot = (textH * l.weight) / sum;
      return { slot, size: fit(l.text, l.bold, slot * 0.78, textW) };
    });
  };

  let measured = sizes(lines);
  for (;;) {
    let drop = -1;
    for (let i = lines.length - 1; i >= (tagBox ? 0 : 1); i--) {
      if (measured[i].size < MIN_FONT_MM) { drop = i; break; }
    }
    if (drop < 0) break;
    warnings.push(`“${lines[drop].text}” was left off: it will not fit legibly at ${W}×${H} mm.`);
    lines = lines.filter((_, i) => i !== drop);
    measured = sizes(lines);
  }
  const tagSize = tagBox ? fit(data.tag, true, tagBox.h * 0.8, tagBox.w) : measured[0]?.size ?? 0;
  if (tagSize < MIN_FONT_MM * 1.4) warnings.push('The asset tag text is very small at this size. Try the text-only layout.');

  let y = textY;
  let text = '';
  if (tagBox) text += `<text x="${num(tagBox.x)}" y="${num(tagBox.y + tagBox.h / 2 + tagSize * 0.35)}" font-size="${num(tagSize)}" font-weight="700">${esc(data.tag)}</text>`;
  lines.forEach((l, i) => {
    const { slot, size } = measured[i];
    text += `<text x="${num(textX)}" y="${num(y + slot / 2 + size * 0.35)}" font-size="${num(size)}" font-weight="${l.bold ? 700 : 400}">${esc(l.text)}</text>`;
    y += slot;
  });

  const border = o.border
    ? `<rect x="${num(bx)}" y="${num(by)}" width="${num(bw)}" height="${num(bh)}" rx="${num(1.2 * s)}" fill="#fff" stroke="#000" stroke-width="${num(stroke)}"/>`
    : '';

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H)}" width="${num(W)}mm" height="${num(H)}mm" ` +
    `font-family="Arial, Helvetica, sans-serif" fill="#000">${border}${art}${text}</svg>`;
  return { svg, warnings };
}

/** Standalone HTML for printing: one label per page (rolls) or a grid (A4 sheets). */
export function buildPrintHtml(svgs: string[], widthMm: number, heightMm: number, mode: 'roll' | 'sheet'): string {
  const css =
    mode === 'roll'
      ? `@page{size:${widthMm}mm ${heightMm}mm;margin:0}
         html,body{margin:0;padding:0;background:#fff}
         .l{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;page-break-after:always;break-after:page}
         .l:last-child{page-break-after:auto;break-after:auto}`
      : `@page{size:A4;margin:8mm}
         html,body{margin:0;padding:0;background:#fff}
         .sheet{display:flex;flex-wrap:wrap;gap:1.5mm;align-content:flex-start}
         .l{width:${widthMm}mm;height:${heightMm}mm;break-inside:avoid;outline:0.1mm dashed #bbb}`;
  const body = svgs.map(s => `<div class="l">${s}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Asset labels</title><style>
    ${css}
    svg{display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body>${mode === 'sheet' ? `<div class="sheet">${body}</div>` : body}</body></html>`;
}
