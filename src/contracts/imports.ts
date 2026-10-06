import { z } from 'zod';
import { packInputSchema, purchaseSchema } from './inventory.js';
const evidence = <T extends z.ZodType>(type: T) =>
  z.strictObject({
    value: type.nullable(),
    raw: z.string().max(500).nullable(),
    evidence: z.string().max(800).nullable(),
    status: z.enum(['visible', 'ambiguous', 'missing']),
    imageIndex: z.number().int().min(0).max(2).nullable(),
  });
export const candidateSchema = z.strictObject({
  name: evidence(z.string().max(300)),
  ingredientText: evidence(z.string().max(300)),
  strengthText: evidence(z.string().max(300)),
  form: evidence(z.string().max(300)),
  packageCount: evidence(z.number().nonnegative().max(100000)),
  expiryText: evidence(z.string().max(300)),
  expiryValue: evidence(z.string().max(10)),
  expiryPrecision: z.enum(['day', 'month', 'unknown']),
  expiryMarker: evidence(z.string().max(100)),
  batch: evidence(z.string().max(300)),
  kind: z.enum(['medicine', 'supplement', 'other', 'unknown']),
  purchasedPacks: evidence(z.number().positive().max(10000)),
  unitPrice: evidence(z.number().nonnegative().max(1000000)),
  lineTotal: evidence(z.number().nonnegative().max(1000000)),
  warnings: z.array(z.string().max(500)).max(20),
});
export const extractionSchema = z.strictObject({
  mode: z.enum(['medicine', 'receipt']),
  pharmacy: evidence(z.string().max(300)),
  purchaseDate: evidence(z.string().max(10)),
  currency: evidence(z.string().regex(/^[A-Z]{3}$/)),
  receiptTotal: evidence(z.number().nonnegative().max(1000000)),
  candidates: z.array(candidateSchema).min(1).max(30),
  warnings: z.array(z.string().max(500)).max(20),
});
export const importDecisionSchema = z.strictObject({
  candidateIndex: z.number().int().min(0).max(29),
  pack: packInputSchema,
  packCount: z.number().int().min(1).max(100),
  purchase: purchaseSchema.nullable(),
  confirmedMedicine: z.literal(true),
});
export const confirmationSchema = z.strictObject({
  decisions: z.array(importDecisionSchema).min(1).max(30),
  duplicateAcknowledged: z.boolean(),
});
export type Extraction = z.infer<typeof extractionSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type ImportDecision = z.infer<typeof importDecisionSchema>;
export type Draft = {
  id: string;
  mode: 'medicine' | 'receipt';
  extraction: Extraction;
  expiresAt: number;
  duplicate: boolean;
  simulated: boolean;
  status: string;
};
