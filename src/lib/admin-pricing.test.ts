import { describe, expect, test } from 'vitest';

import { summarizeAdminPricing } from './admin-pricing';

describe('summarizeAdminPricing', () => {
  test('summarizes active prices, PIX gaps, comparison gaps and inventory value', () => {
    const summary = summarizeAdminPricing([
      {
        status: 'active',
        priceCents: 10000,
        pixPriceCents: 9700,
        compareAtPriceCents: 12000,
        totalStock: 2,
      },
      {
        status: 'active',
        priceCents: 5000,
        pixPriceCents: null,
        compareAtPriceCents: null,
        totalStock: 4,
      },
      {
        status: 'draft',
        priceCents: 20000,
        pixPriceCents: null,
        compareAtPriceCents: null,
        totalStock: 8,
      },
    ]);

    expect(summary).toEqual({
      activeProductCount: 2,
      averageActivePriceCents: 7500,
      inventoryValueCents: 40000,
      productCount: 3,
      productsWithoutCompareAtPrice: 1,
      productsWithoutPixPrice: 1,
    });
  });
});
