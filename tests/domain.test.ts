import { describe, it, expect } from 'vitest';
import {
  expiryState,
  todayIn,
  plusDays,
  guidanceBlocks,
  reviewedSources,
} from '../src/domain/expiry.js';
import {
  packInputSchema,
  productSchema,
  type Pack,
  type SourceFact,
} from '../src/contracts/inventory.js';
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
it('requires exact source revision and opening dates before showing leaflet facts', () => {
  const source: SourceFact = {
    id: 'synthetic-source',
    productId: 'synthetic-product',
    officialUrl: 'https://example.org/synthetic',
    revision: 'fixture-1',
    provenance: 'Synthetic test only',
    reviewStatus: 'reviewed',
    facts: [],
    afterOpeningDays: 10,
    expiryConvention: null,
    permission: 'Project-owned synthetic fixture',
    reviewedAt: '2026-10-01',
    productVersion: 4,
  };
  const pack: Pack = {
    ...packInputSchema.parse({
      productId: 'b01bd80a-0676-4500-b8a3-6950bf33bec1',
      quantity: 1,
      unit: 'pack',
      expiryValue: '2027-01-01',
      expiryPrecision: 'day',
    }),
    id: 'synthetic-pack',
    productId: source.productId,
    product: {
      ...productSchema.parse({ name: 'Synthetic only', identityConfirmed: true }),
      id: source.productId,
      version: 4,
      prescriptionStatus: 'unknown',
    },
    version: 5,
    createdAt: '2026-10-01T00:00:00.000Z',
    archived: false,
    purchase: null,
    sourceFacts: [source],
  };
  expect(guidanceBlocks(pack, '2026-10-11')).toContain(
    'The opening date is required by the reviewed after-opening rule.',
  );
  pack.openedDate = '2026-10-01';
  expect(guidanceBlocks(pack, '2026-10-11')).toEqual([]);
  expect(guidanceBlocks(pack, '2026-10-12')).toContain(
    'The reviewed after-opening limit has passed.',
  );
  expect(reviewedSources({ ...pack, sourceFacts: [{ ...source, productVersion: 3 }] })).toEqual([]);
  expect(reviewedSources({ ...pack, sourceFacts: [{ ...source, permission: '' }] })).toEqual([]);
  expect(reviewedSources({ ...pack, sourceFacts: [{ ...source, reviewedAt: null }] })).toEqual([]);
});
