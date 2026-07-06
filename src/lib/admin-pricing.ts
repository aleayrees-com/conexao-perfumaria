export interface AdminPricingProduct {
  readonly status: string;
  readonly priceCents: number;
  readonly pixPriceCents: number | null;
  readonly compareAtPriceCents: number | null;
  readonly totalStock: number;
}

export interface AdminPricingSummary {
  readonly activeProductCount: number;
  readonly averageActivePriceCents: number;
  readonly inventoryValueCents: number;
  readonly productCount: number;
  readonly productsWithoutCompareAtPrice: number;
  readonly productsWithoutPixPrice: number;
}

export function summarizeAdminPricing(
  products: readonly AdminPricingProduct[],
): AdminPricingSummary {
  const activeProducts = products.filter(
    (product) => product.status === 'active',
  );
  const activePriceTotal = activeProducts.reduce(
    (total, product) => total + product.priceCents,
    0,
  );

  return {
    activeProductCount: activeProducts.length,
    averageActivePriceCents:
      activeProducts.length === 0
        ? 0
        : Math.round(activePriceTotal / activeProducts.length),
    inventoryValueCents: activeProducts.reduce(
      (total, product) =>
        total + Math.max(0, product.totalStock) * product.priceCents,
      0,
    ),
    productCount: products.length,
    productsWithoutCompareAtPrice: activeProducts.filter(
      (product) => product.compareAtPriceCents === null,
    ).length,
    productsWithoutPixPrice: activeProducts.filter(
      (product) => product.pixPriceCents === null,
    ).length,
  };
}
