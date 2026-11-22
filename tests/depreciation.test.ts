import { describe, expect, it } from 'vitest';
import { depreciationFor, describeAge } from '@/lib/depreciation';
import { dmy } from '@/lib/dates';

const policy = { usefulLifeYears: 4, depreciationMethod: 'straight-line' as const };

describe('depreciationFor', () => {
  it('writes the asset down evenly over its useful life', () => {
    const d = depreciationFor({ purchasePrice: 100000, purchaseDate: '2024-11-22' }, policy, new Date('2026-11-22T00:00:00'));
    expect(d.percent).toBeCloseTo(50, 0);
    expect(d.current).toBeCloseTo(50000, -2);
    expect(d.depreciated + d.current).toBeCloseTo(100000, 1);
  });

  it('never goes below zero after the useful life', () => {
    const d = depreciationFor({ purchasePrice: 100000, purchaseDate: '2015-01-01' }, policy, new Date('2026-11-22'));
    expect(d.current).toBe(0);
    expect(d.percent).toBe(100);
  });

  it('keeps the full cost on the day of purchase', () => {
    const d = depreciationFor({ purchasePrice: 5000, purchaseDate: '2026-11-22' }, policy, new Date('2026-11-22T00:00:00'));
    expect(d.current).toBe(5000);
    expect(d.percent).toBe(0);
  });

  it('does not depreciate when the policy says none', () => {
    const d = depreciationFor({ purchasePrice: 5000, purchaseDate: '2020-01-01' }, { usefulLifeYears: 4, depreciationMethod: 'none' }, new Date('2026-11-22'));
    expect(d.current).toBe(5000);
    expect(d.endOfLife).toBe('');
  });

  it('does not guess when the purchase date is missing', () => {
    const d = depreciationFor({ purchasePrice: 5000 }, policy, new Date('2026-11-22'));
    expect(d.current).toBe(5000);
    expect(d.method).toBe('none');
  });

  it('reports the end-of-life date', () => expect(depreciationFor({ purchasePrice: 1, purchaseDate: '2024-01-01' }, policy).endOfLife).toBe('2028-01-01'));
});

describe('describeAge and dmy', () => {
  it('describes ages', () => {
    expect(describeAge(2.3)).toBe('2 yrs 3 mo');
    expect(describeAge(1)).toBe('1 yr');
    expect(describeAge(0.4)).toBe('4 mo');
    expect(describeAge(0.01)).toBe('3 days');
  });
  it('formats dates like the labels', () => {
    expect(dmy('2026-10-19')).toBe('19-Oct-2026');
    expect(dmy('')).toBe('');
    expect(dmy('garbage')).toBe('');
  });
});
