import { extractionSchema, type Extraction } from '../contracts/imports.js';
import { dateOnly, validExpiry } from '../contracts/inventory.js';
export function reviewExtraction(
  value: unknown,
  mode: 'medicine' | 'receipt',
  imageCount: number,
): Extraction {
  const result = extractionSchema.parse(value);
  if (result.mode !== mode) throw new Error('Wrong extraction mode.');
  for (const field of [
    result.pharmacy,
    result.purchaseDate,
    result.currency,
    result.receiptTotal,
    ...result.candidates.flatMap((c) => [
      c.name,
      c.ingredientText,
      c.strengthText,
      c.form,
      c.packageCount,
      c.expiryText,
      c.expiryValue,
      c.expiryMarker,
      c.batch,
      c.purchasedPacks,
      c.unitPrice,
      c.lineTotal,
    ]),
  ]) {
    if (field.imageIndex !== null && field.imageIndex >= imageCount)
      throw new Error('Unknown evidence image.');
    if (
      field.value !== null &&
      (field.status !== 'visible' || field.imageIndex === null || !field.evidence)
    )
      field.value = null;
  }
  if (result.purchaseDate.value && !dateOnly.safeParse(result.purchaseDate.value).success) {
    result.warnings.push('The purchase date is ambiguous. Enter it manually.');
    result.purchaseDate.value = null;
  }
  for (const c of result.candidates) {
    if (
      mode === 'receipt' ||
      c.warnings.some((w) => /conflict|contradict|different expir/i.test(w)) ||
      !c.expiryMarker.value ||
      !/\b(exp|expiry|expires|use[ -]?by|годен|валиден|срок)\b/i.test(c.expiryMarker.value) ||
      !validExpiry({ expiryValue: c.expiryValue.value, expiryPrecision: c.expiryPrecision })
    ) {
      if (c.expiryValue.value)
        c.warnings.push('Expiry could not be verified from an explicit expiry marker.');
      c.expiryValue.value = null;
      c.expiryPrecision = 'unknown';
    }
    if (
      c.purchasedPacks.value &&
      c.unitPrice.value !== null &&
      c.lineTotal.value !== null &&
      Math.abs(c.purchasedPacks.value * c.unitPrice.value - c.lineTotal.value) > 0.02
    )
      c.warnings.push(
        'Quantity × unit price differs from the visible line total. Check the receipt; values have not been repaired.',
      );
  }
  if (
    mode === 'receipt' &&
    result.receiptTotal.value !== null &&
    result.candidates.every((c) => c.lineTotal.value !== null) &&
    Math.abs(
      result.candidates.reduce((n, c) => n + c.lineTotal.value!, 0) - result.receiptTotal.value,
    ) > 0.02
  )
    result.warnings.push(
      'Line totals differ from the visible receipt total. Check discounts or missing lines.',
    );
  return result;
}
