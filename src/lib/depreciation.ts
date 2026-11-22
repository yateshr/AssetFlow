/** Book value of an asset, from the policy's useful life and method. */
export interface Depreciation {
  cost: number;
  current: number;
  depreciated: number;
  /** 0-100 */
  percent: number;
  ageYears: number;
  usefulLifeYears: number;
  /** ISO date when the asset is fully written down (empty when there is no purchase date or no depreciation). */
  endOfLife: string;
  method: 'straight-line' | 'none';
}

const YEAR_MS = 365.25 * 86_400_000;

export function depreciationFor(
  asset: { purchasePrice: number; purchaseDate?: string },
  policy: { usefulLifeYears: number; depreciationMethod: 'straight-line' | 'none' },
  now = new Date(),
): Depreciation {
  const cost = Number(asset.purchasePrice) || 0;
  const life = Math.max(1, Number(policy.usefulLifeYears) || 1);
  const bought = asset.purchaseDate ? new Date(`${asset.purchaseDate.slice(0, 10)}T00:00:00`) : null;
  const valid = bought && !Number.isNaN(bought.getTime());
  const ageYears = valid ? Math.max(0, (now.getTime() - bought!.getTime()) / YEAR_MS) : 0;

  const none = policy.depreciationMethod === 'none' || !valid;
  const written = none ? 0 : Math.min(1, ageYears / life);
  const depreciated = Math.round(cost * written * 100) / 100;
  let end = '';
  if (valid && !none) {
    const eol = new Date(bought!);
    eol.setFullYear(eol.getFullYear() + life);
    // Local date parts: toISOString would shift the day in time zones ahead of UTC.
    end = `${eol.getFullYear()}-${String(eol.getMonth() + 1).padStart(2, '0')}-${String(eol.getDate()).padStart(2, '0')}`;
  }

  return {
    cost,
    current: Math.round((cost - depreciated) * 100) / 100,
    depreciated,
    percent: Math.round(written * 1000) / 10,
    ageYears,
    usefulLifeYears: life,
    endOfLife: end,
    method: none ? 'none' : 'straight-line',
  };
}

/** "2 yrs 3 mo", "5 mo", "12 days" */
export function describeAge(years: number): string {
  const months = Math.floor(years * 12);
  if (months >= 12) {
    const y = Math.floor(months / 12);
    const m = months % 12;
    return `${y} yr${y > 1 ? 's' : ''}${m ? ` ${m} mo` : ''}`;
  }
  if (months >= 1) return `${months} mo`;
  const days = Math.floor(years * 365.25);
  return `${days} day${days === 1 ? '' : 's'}`;
}
