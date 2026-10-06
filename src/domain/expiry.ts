import type { Pack } from '../contracts/inventory.js';
export type ExpiryState = 'unknown' | 'expired' | 'soon' | 'recorded' | 'month-current';
export function todayIn(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const p = (type: string) => parts.find((x) => x.type === type)!.value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
export function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function expiryState(
  pack: Pick<Pack, 'expiryValue' | 'expiryPrecision'>,
  today: string,
): ExpiryState {
  if (!pack.expiryValue || pack.expiryPrecision === 'unknown') return 'unknown';
  if (pack.expiryPrecision === 'month') {
    const month = today.slice(0, 7);
    if (pack.expiryValue < month) return 'expired';
    if (pack.expiryValue === month) return 'month-current';
    return pack.expiryValue <= plusDays(today, 30).slice(0, 7) ? 'soon' : 'recorded';
  }
  if (pack.expiryValue < today) return 'expired';
  return pack.expiryValue <= plusDays(today, 30) ? 'soon' : 'recorded';
}
export function guidanceBlocks(pack: Pack, today: string): string[] {
  const blocks: string[] = [];
  const source = pack.sourceFacts.find((s) => s.reviewStatus === 'reviewed');
  if (!pack.product.identityConfirmed) blocks.push('Product identity has not been confirmed.');
  if (!source) blocks.push('No reviewed leaflet information is available for this exact product.');
  const state = expiryState(pack, today);
  if (state === 'unknown') blocks.push('The expiry date is unknown.');
  if (state === 'expired') blocks.push('The recorded expiry has passed.');
  if (state === 'month-current' && source?.expiryConvention !== 'month_end')
    blocks.push('The printed expiry gives only a month; its convention is unverified.');
  if (pack.storageUncertain) blocks.push('Storage conditions are uncertain.');
  if (source?.afterOpeningDays != null) {
    if (!pack.openedDate)
      blocks.push('The opening date is required by the reviewed after-opening rule.');
    else if (plusDays(pack.openedDate, source.afterOpeningDays) < today)
      blocks.push('The reviewed after-opening limit has passed.');
  }
  if (pack.quantity === 0 || pack.archived) blocks.push('This pack is not in stock.');
  return blocks;
}
