/**
 * Shared CSV / Excel export for every list in the app.
 * Cells are neutralised against spreadsheet formula injection, and the Excel
 * file is loaded on demand so it does not weigh down the main bundle.
 */
export type ExportCell = string | number | boolean | null | undefined;
export interface ExportTable {
  /** File name without extension; the date is appended. */
  name: string;
  /** Sheet name for Excel (max 31 chars). */
  sheet?: string;
  headers: string[];
  rows: ExportCell[][];
}

const safeText = (v: ExportCell) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const text = String(v);
  return /^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
};

const stamp = () => new Date().toISOString().slice(0, 10);

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(t: ExportTable) {
  const cell = (v: ExportCell) => `"${(typeof v === 'number' ? String(v) : safeText(v)).replace(/"/g, '""')}"`;
  const csv = '﻿' + [t.headers, ...t.rows].map(r => r.map(cell).join(',')).join('\r\n');
  save(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${t.name}-${stamp()}.csv`);
}

export async function exportExcel(t: ExportTable) {
  const XLSX = await import('xlsx');
  const body = t.rows.map(r => r.map(v => (typeof v === 'number' ? v : safeText(v))));
  const sheet = XLSX.utils.aoa_to_sheet([t.headers, ...body]);
  sheet['!cols'] = t.headers.map((h, i) => ({
    wch: Math.min(48, Math.max(10, h.length + 2, ...body.slice(0, 500).map(r => String(r[i] ?? '').length + 2))),
  }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, body.length), c: Math.max(0, t.headers.length - 1) } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, (t.sheet || t.name).replace(/[\/*?:[\]]/g, '').slice(0, 31) || 'Sheet1');
  XLSX.writeFile(wb, `${t.name}-${stamp()}.xlsx`);
}
