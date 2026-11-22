import { describe, expect, it } from 'vitest';
import { buildTag, highestUsedNumber, type TagParts } from '@/lib/assetTag';

const base: TagParts = { companyPrefix: 'NP', functionPrefix: 'IT', useFunctionPrefix: true, series: 'B', digits: 4, separator: '-' };

describe('buildTag', () => {
  it('builds the standard tag', () => expect(buildTag(base, 'CPU', 288)).toBe('NP-IT-CPU-B0288'));

  it('uses the chosen separator', () => {
    expect(buildTag({ ...base, separator: '/' }, 'CPU', 1)).toBe('NP/IT/CPU/B0001');
    expect(buildTag({ ...base, separator: '.' }, 'CPU', 1)).toBe('NP.IT.CPU.B0001');
    expect(buildTag({ ...base, separator: '_' }, 'CPU', 1)).toBe('NP_IT_CPU_B0001');
    expect(buildTag({ ...base, separator: '' }, 'CPU', 1)).toBe('NPITCPUB0001');
  });

  it('can leave the department code out', () => expect(buildTag({ ...base, useFunctionPrefix: false }, 'MON', 5)).toBe('NP-MON-B0005'));

  it('skips empty parts instead of producing double separators', () => {
    expect(buildTag({ ...base, functionPrefix: '' }, 'MON', 5)).toBe('NP-MON-B0005');
    expect(buildTag({ ...base, series: '' }, 'MON', 5)).toBe('NP-IT-MON-0005');
  });

  it('pads to the configured digits', () => expect(buildTag({ ...base, digits: 6 }, 'MON', 42)).toBe('NP-IT-MON-B000042'));
});

describe('highestUsedNumber', () => {
  const assets = [
    { siteId: 'S1', assetTag: 'NP-IT-CPU-B0288' },
    { siteId: 'S1', assetTag: 'NP-IT-MOU-B0362' },
    { siteId: 'S1', assetTag: 'NP-IT-CPU-A0900' }, // other series
    { siteId: 'S2', assetTag: 'NP-IT-CPU-B0999' }, // other site
    { siteId: 'S1', assetTag: 'XX-IT-CPU-B0777' }, // other company prefix
    { siteId: 'S1', assetTag: 'NP/MON/B0400' }, // different separator, same series
  ];

  it('finds the highest number for the site, prefix and series', () => expect(highestUsedNumber(assets, 'S1', 'NP', 'B')).toBe(400));

  it('ignores other series, sites and prefixes', () => {
    expect(highestUsedNumber(assets, 'S1', 'NP', 'A')).toBe(900);
    expect(highestUsedNumber(assets, 'S2', 'NP', 'B')).toBe(999);
    expect(highestUsedNumber(assets, 'S3', 'NP', 'B')).toBe(0);
  });

  it('copes with missing tags', () => expect(highestUsedNumber([{ siteId: 'S1' }], 'S1', 'NP', 'B')).toBe(0));
});
