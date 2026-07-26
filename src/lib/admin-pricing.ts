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

const CARD_PRICE_MARKUP_BASIS_POINTS = 754;
const BASIS_POINTS_SCALE = 10_000;

export function calculateCardPriceCents(pixPriceCents: number): number {
  if (!Number.isInteger(pixPriceCents) || pixPriceCents < 0) {
    throw new Error(
      `PIX price cents "${pixPriceCents}" must be a non-negative integer.`,
    );
  }

  return Math.round(
    (pixPriceCents * (BASIS_POINTS_SCALE + CARD_PRICE_MARKUP_BASIS_POINTS)) /
      BASIS_POINTS_SCALE,
  );
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
