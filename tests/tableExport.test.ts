import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportCsv } from '@/lib/tableExport';

let saved: Blob | null = null;

beforeEach(() => {
  saved = null;
  vi.stubGlobal('document', { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } });
  (URL as any).createObjectURL = (b: Blob) => { saved = b; return 'blob:test'; };
  (URL as any).revokeObjectURL = () => {};
});
afterEach(() => vi.unstubAllGlobals());

const csvOf = async (rows: any[][]) => {
  exportCsv({ name: 't', headers: ['a', 'b'], rows });
  return (await saved!.text()).replace(/^﻿/, '');
};

describe('exportCsv', () => {
  it('neutralises spreadsheet formulas', async () => expect(await csvOf([['=SUM(1)', 'x']])).toContain('"\'=SUM(1)"'));
  it('also neutralises +, @ and tab prefixes', async () => {
    const out = await csvOf([['+1+1', '@cmd'], ['\tx', 'y']]);
    expect(out).toContain('"\'+1+1"');
    expect(out).toContain('"\'@cmd"');
  });
  it('keeps negative numbers as numbers', async () => expect(await csvOf([['-12', 5]])).toContain('"-12"'));
  it('escapes quotes and handles booleans and blanks', async () => {
    const out = await csvOf([['he said "hi"', null], [true, false]]);
    expect(out).toContain('"he said ""hi"""');
    expect(out).toContain('"Yes","No"');
  });
  it('starts with a byte order mark so Excel reads Unicode', async () => {
    exportCsv({ name: 't', headers: ['a'], rows: [['₹']] });
    const bytes = new Uint8Array(await saved!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });
});
