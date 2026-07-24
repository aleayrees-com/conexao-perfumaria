/**
 * Extracts each distinct product selected for a quick price update.
 *
 * @example createAdminPriceUpdateIds(['product-1', 'product-1']) // ['product-1']
 */
export function createAdminPriceUpdateIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/**
 * Stores only prices that differ from the catalog value.
 *
 * @example updateAdminPriceChanges({}, 'product-1', 10000, 9500)
 */
export function updateAdminPriceChanges(
  changes: Readonly<Record<string, number>>,
  productId: string,
  originalPriceCents: number,
  nextPriceCents: number,
): Record<string, number> {
  if (nextPriceCents !== originalPriceCents) {
    return { ...changes, [productId]: nextPriceCents };
  }

  const unchangedPrices = { ...changes };
  delete unchangedPrices[productId];

  return unchangedPrices;
}
