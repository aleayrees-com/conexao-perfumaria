import { describe, expect, test } from 'vitest';

import {
  applyMoneyOperation,
  buildBulkProductsCsv,
  parseBulkProductsCsv,
} from './admin-product-bulk';

describe('applyMoneyOperation', () => {
  test('sets a fixed money value', () => {
    expect(
      applyMoneyOperation(12990, {
        mode: 'set',
        value: 9990,
      }),
    ).toBe(9990);
  });

  test('increases by percentage and rounds to cents', () => {
    expect(
      applyMoneyOperation(9990, {
        mode: 'increase_percent',
        value: 12.5,
      }),
    ).toBe(11239);
  });

  test('decreases by amount and clamps at zero', () => {
    expect(
      applyMoneyOperation(3000, {
        mode: 'decrease_amount',
        value: 5000,
      }),
    ).toBe(0);
  });

  test('clears optional money fields', () => {
    expect(
      applyMoneyOperation(8990, {
        mode: 'clear',
        value: null,
      }),
    ).toBeNull();
  });
});

describe('bulk product CSV', () => {
  test('escapes product names and keeps blank optional prices', () => {
    const csv = buildBulkProductsCsv([
      {
        productId: 'product-1',
        slug: 'floral',
        name: 'Perfume Floral, Edicao "Especial"',
        status: 'active',
        categoryId: null,
        priceCents: 12990,
        pixPriceCents: null,
        compareAtPriceCents: 15990,
        variantId: 'variant-1',
        variantLabel: '100ml',
        variantSku: 'SKU-1',
        variantPriceCents: 12990,
        variantPixPriceCents: null,
        variantCompareAtPriceCents: 15990,
        variantStock: 12,
        variantAvailable: true,
      },
    ]);

    expect(csv).toContain('"Perfume Floral, Edicao ""Especial"""');
    expect(csv).toContain(',12,sim');
    expect(csv).toContain('129.90,,159.90');
  });

  test('parses quoted commas and optional blank prices', () => {
    const csv = [
      'product_id,slug,name,status,category_id,price,pix_price,compare_at_price,variant_id,variant_label,variant_sku,variant_price,variant_pix_price,variant_compare_at_price,variant_stock,variant_available',
      'product-1,floral,"Perfume Floral, Especial",active,,129.90,,159.90,variant-1,100ml,SKU-1,129.90,,,12,sim',
    ].join('\n');

    const result = parseBulkProductsCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        productId: 'product-1',
        slug: 'floral',
        name: 'Perfume Floral, Especial',
        status: 'active',
        categoryId: '',
        price: '129.90',
        pixPrice: '',
        compareAtPrice: '159.90',
        variantId: 'variant-1',
        variantLabel: '100ml',
        variantSku: 'SKU-1',
        variantPrice: '129.90',
        variantPixPrice: '',
        variantCompareAtPrice: '',
        variantStock: '12',
        variantAvailable: 'sim',
      },
    ]);
  });
});
