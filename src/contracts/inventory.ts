import { z } from 'zod';
export const text = z.string().trim().max(300);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date.');
export const monthOnly = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const ingredientSchema = z.strictObject({
  name: text.min(1),
  strength: text.nullable(),
  unit: text.nullable(),
  basis: text.nullable(),
});
export const productSchema = z.strictObject({
  name: text.min(1),
  country: text.default('BG'),
  form: text.nullable().default(null),
  route: text.nullable().default(null),
  ingredientText: text.nullable().default(null),
  ingredients: z.array(ingredientSchema).max(12).default([]),
  identityConfirmed: z.boolean().default(false),
});
export const packFields = z.strictObject({
  quantity: z.number().min(0).max(100000),
  unit: text.min(1),
  locationId: z.string().uuid().nullable().default(null),
  expiryValue: z.union([dateOnly, monthOnly]).nullable(),
  expiryPrecision: z.enum(['day', 'month', 'unknown']),
  expiryText: text.nullable().default(null),
  batch: text.nullable().default(null),
  openedDate: dateOnly.nullable().default(null),
  storageUncertain: z.boolean().default(false),
  notes: z.string().trim().max(2000).default(''),
});
export const validExpiry = (v: { expiryValue: string | null; expiryPrecision: string }) =>
  v.expiryPrecision === 'unknown'
    ? v.expiryValue === null
    : v.expiryValue !== null &&
      (v.expiryPrecision === 'month'
        ? monthOnly.safeParse(v.expiryValue).success
        : dateOnly.safeParse(v.expiryValue).success);
export const packInputSchema = packFields
  .extend({
    productId: z.string().uuid().nullable().default(null),
    product: productSchema.nullable().default(null),
  })
  .refine(validExpiry, 'Expiry value must match its precision.')
  .refine(
    (v) => !!v.productId !== !!v.product,
    'Choose an existing product or enter a new product.',
  );
export const packEditSchema = packFields
  .extend({ version: z.number().int().positive() })
  .refine(validExpiry, 'Expiry value must match its precision.');
export const purchaseSchema = z.strictObject({
  date: dateOnly.nullable(),
  pharmacy: text.nullable(),
  purchasedPacks: z.number().positive().max(10000).nullable(),
  unitPrice: z.number().nonnegative().max(1000000).nullable(),
  lineTotal: z.number().nonnegative().max(1000000).nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
});
export type ProductInput = z.infer<typeof productSchema>;
export type PackInput = z.infer<typeof packInputSchema>;
export type PackFields = z.infer<typeof packFields>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type Product = ProductInput & {
  id: string;
  prescriptionStatus: 'unknown' | 'otc' | 'prescription';
};
export type SourceFact = {
  id: string;
  productId: string;
  officialUrl: string;
  revision: string;
  provenance: string;
  reviewStatus: 'unreviewed' | 'reviewed';
  facts: string[];
  afterOpeningDays: number | null;
  expiryConvention: 'month_end' | null;
};
export type Pack = PackFields & {
  id: string;
  productId: string;
  product: Product;
  version: number;
  archived: boolean;
  createdAt: string;
  sourceFacts: SourceFact[];
  purchase: Purchase | null;
};
export type Location = { id: string; name: string };
export type Settings = { timezone: string; emergencyContact: string; emergencyLocation: string };
