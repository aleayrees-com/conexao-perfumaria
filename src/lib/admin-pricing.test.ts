import { describe, expect, test } from 'vitest';

import {
  calculateCardPriceCents,
  summarizeAdminPricing,
} from './admin-pricing';

describe('calculateCardPriceCents', () => {
  test('applies the fixed 7.54% card markup to the PIX price', () => {
    expect(calculateCardPriceCents(30000)).toBe(32262);
    expect(calculateCardPriceCents(10000)).toBe(10754);
  });

  test('rounds to the nearest cent', () => {
    expect(calculateCardPriceCents(1)).toBe(1);
    expect(calculateCardPriceCents(101)).toBe(109);
  });

  test('rejects invalid cent values', () => {
    expect(() => calculateCardPriceCents(-1)).toThrow(
      'PIX price cents "-1" must be a non-negative integer.',
    );
    expect(() => calculateCardPriceCents(1.5)).toThrow(
      'PIX price cents "1.5" must be a non-negative integer.',
    );
  });
});

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
