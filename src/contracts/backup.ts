import { z } from 'zod';
import {
  productSchema,
  packFields,
  purchaseSchema,
  text,
  validExpiry,
  dateOnly,
} from './inventory.js';
import { todayIn } from '../domain/expiry.js';
export const settingsSchema = z.strictObject({
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        todayIn(v);
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid IANA timezone.'),
  emergencyContact: text,
  emergencyLocation: text,
});
export const storedProductSchema = productSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().positive().max(1_000_000_000),
  prescriptionStatus: z.enum(['unknown', 'otc', 'prescription']),
});
export const storedPackSchema = packFields
  .extend({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    version: z.number().int().positive().max(1_000_000_000),
    archived: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .refine(validExpiry, 'Expiry value must match its precision.');
export const sourceSchema = z.strictObject({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  officialUrl: z
    .string()
    .url()
    .max(2000)
    .refine(
      (v) => new URL(v).protocol === 'https:' && !new URL(v).username && !new URL(v).password,
      'Use an HTTPS official source URL without credentials.',
    ),
  revision: text.min(1),
  provenance: z.string().max(2000),
  reviewStatus: z.enum(['unreviewed', 'reviewed']),
  facts: z.array(z.string().max(2000)).max(50),
  afterOpeningDays: z.number().int().positive().max(36500).nullable(),
  expiryConvention: z.literal('month_end').nullable(),
  permission: z.string().max(2000),
  reviewedAt: dateOnly.nullable(),
  productVersion: z.number().int().positive().max(1_000_000_000),
});
export const backupSchema = z.strictObject({
  format: z.literal('cabivue'),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  settings: settingsSchema,
  locations: z.array(z.strictObject({ id: z.string().uuid(), name: text.min(1) })).max(200),
  products: z.array(storedProductSchema).max(5000),
  packs: z.array(storedPackSchema).max(5000),
  sources: z.array(sourceSchema).max(1000),
  purchaseLines: z.array(purchaseSchema.extend({ id: z.string().uuid() })).max(5000),
  packPurchases: z
    .array(z.strictObject({ packId: z.string().uuid(), purchaseLineId: z.string().uuid() }))
    .max(5000),
  imports: z
    .array(
      z.strictObject({
        id: z.string().uuid(),
        mode: z.enum(['medicine', 'receipt']),
        fingerprint: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
        packIds: z.array(z.string().uuid()).max(100),
        confirmedAt: z.iso.datetime(),
      }),
    )
    .max(10000),
});
export type Backup = z.infer<typeof backupSchema>;
export function validateBackup(value: unknown): Backup {
  const b = backupSchema.parse(value);
  const unique = (ids: string[], name: string) => {
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${name} identifiers.`);
  };
  for (const key of [
    'products',
    'packs',
    'sources',
    'locations',
    'purchaseLines',
    'imports',
  ] as const)
    unique(
      b[key].map((x) => x.id),
      key,
    );
  unique(
    b.locations.map((x) => x.name.toLocaleLowerCase()),
    'location name',
  );
  unique(
    b.packPurchases.map((x) => x.packId),
    'pack purchase',
  );
  const products = new Map(b.products.map((x) => [x.id, x]));
  const packs = new Set(b.packs.map((x) => x.id));
  const locations = new Set(b.locations.map((x) => x.id));
  const purchases = new Set(b.purchaseLines.map((x) => x.id));
  if (
    b.packs.some(
      (p) => !products.has(p.productId) || (p.locationId !== null && !locations.has(p.locationId)),
    )
  )
    throw new Error('A pack references an unknown product or location.');
  if (b.packPurchases.some((p) => !packs.has(p.packId) || !purchases.has(p.purchaseLineId)))
    throw new Error('A purchase link references an unknown record.');
  for (const source of b.sources) {
    const p = products.get(source.productId);
    if (!p) throw new Error('A source references an unknown product.');
    if (
      source.reviewStatus === 'reviewed' &&
      (!source.permission.trim() || !source.reviewedAt || source.productVersion !== p.version)
    )
      throw new Error(
        'Reviewed source data needs exact product revision, review date, and source permission.',
      );
  }
  return b;
}
