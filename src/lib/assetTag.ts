/** Asset tag format helpers shared by the setup screen, the asset form and the tests. */
export type TagSeparator = '-' | '.' | '_' | '/' | '';

export interface TagParts {
  companyPrefix: string;
  functionPrefix: string;
  useFunctionPrefix: boolean;
  series: string;
  digits: number;
  separator: TagSeparator;
}

export const pad = (n: number, digits: number) => String(n).padStart(digits, '0');

/** NP-IT-LAP-A0001 (or NP.LAP.A0001 without the department code). Empty parts are skipped. */
export function buildTag(p: TagParts, typeCode: string, n: number): string {
  return [p.companyPrefix, p.useFunctionPrefix ? p.functionPrefix : '', typeCode, `${p.series}${pad(n, p.digits)}`]
    .filter(part => part !== '' && part != null)
    .join(p.separator);
}

/** Highest counter already used by assets at a site for this company prefix and series (0 if none). */
export function highestUsedNumber(
  assets: Array<{ siteId?: string; assetTag?: string }>,
  siteId: string,
  companyPrefix: string,
  series: string,
): number {
  const tail = new RegExp(`${series.replace(/[^A-Z0-9]/gi, '')}(\\d+)$`, 'i');
  let highest = 0;
  for (const asset of assets) {
    const tag = (asset.assetTag || '').toUpperCase();
    if (asset.siteId !== siteId || !tag.startsWith(companyPrefix.toUpperCase())) continue;
    const m = tag.match(tail);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return highest;
}
