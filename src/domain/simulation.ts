import type { Extraction, Candidate } from '../contracts/imports.js';
const field = <T>(value: T | null, raw: string | null = null) => ({
  value,
  raw: raw ?? (value === null ? null : String(value)),
  evidence: value === null ? null : `SYNTHETIC: ${raw ?? value}`,
  status: value === null ? ('missing' as const) : ('visible' as const),
  imageIndex: value === null ? null : 0,
});
export function simulatedExtraction(mode: 'medicine' | 'receipt'): Extraction {
  const base: Candidate = {
    name: field('Sample package · simulated'),
    ingredientText: field(null),
    strengthText: field(null),
    form: field('Fictional sample'),
    packageCount: field(null),
    expiryText: field(null),
    expiryValue: field(null),
    expiryPrecision: 'unknown',
    expiryMarker: field(null),
    batch: field('SYNTHETIC'),
    kind: 'unknown',
    purchasedPacks: field(null),
    unitPrice: field(null),
    lineTotal: field(null),
    warnings: ['Simulated extraction, not OCR. This output does not read your image.'],
  };
  return {
    mode,
    pharmacy: field(mode === 'receipt' ? 'Synthetic pharmacy' : null),
    purchaseDate: field(mode === 'receipt' ? '2026-10-01' : null),
    currency: field(mode === 'receipt' ? 'EUR' : null),
    receiptTotal: field(mode === 'receipt' ? 12 : null),
    candidates:
      mode === 'receipt'
        ? [
            {
              ...base,
              name: field('SAMPLE TAB.'),
              kind: 'medicine',
              purchasedPacks: field(2),
              unitPrice: field(5),
              lineTotal: field(10),
            },
            {
              ...base,
              name: field('SAMPLE SOAP'),
              kind: 'other',
              purchasedPacks: field(1),
              unitPrice: field(2),
              lineTotal: field(2),
            },
          ]
        : [base],
    warnings: ['Synthetic demonstration. No provider call was made.'],
  };
}
