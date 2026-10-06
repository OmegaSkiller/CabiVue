import { describe, it, expect } from 'vitest';
import { expiryState, todayIn, plusDays, guidanceBlocks } from '../src/domain/expiry.js';
import { packInputSchema } from '../src/contracts/inventory.js';
describe('calendar precision and unknown values', () => {
  it('uses the household day instead of the UTC day', () =>
    expect(todayIn('Europe/Sofia', new Date('2026-10-05T22:30:00Z'))).toBe('2026-10-06'));
  it('does not invent a day for month-only expiry', () => {
    expect(expiryState({ expiryValue: '2026-10', expiryPrecision: 'month' }, '2026-10-31')).toBe(
      'month-current',
    );
    expect(expiryState({ expiryValue: '2026-10', expiryPrecision: 'month' }, '2026-11-01')).toBe(
      'expired',
    );
  });
  it('preserves a printed date on its boundary day', () => {
    expect(expiryState({ expiryValue: '2026-10-06', expiryPrecision: 'day' }, '2026-10-06')).toBe(
      'soon',
    );
    expect(expiryState({ expiryValue: '2026-10-06', expiryPrecision: 'day' }, '2026-10-07')).toBe(
      'expired',
    );
    expect(plusDays('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('unknown is not unexpired', () =>
    expect(expiryState({ expiryValue: null, expiryPrecision: 'unknown' }, '2026-10-06')).toBe(
      'unknown',
    ));
  it('rejects invented calendar dates and inconsistent precision', () => {
    const input = {
      quantity: 1,
      unit: 'pack',
      product: { name: 'Synthetic' },
      expiryPrecision: 'day',
      expiryValue: '2026-02-30',
    };
    expect(packInputSchema.safeParse(input).success).toBe(false);
    expect(
      packInputSchema.safeParse({ ...input, expiryPrecision: 'unknown', expiryValue: '2026-10' })
        .success,
    ).toBe(false);
  });
});
