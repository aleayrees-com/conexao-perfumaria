import { describe, expect, it } from 'vitest';

import { selectHomeFeaturedProducts } from '@/lib/home-curation';
import type { Product } from '@/types/catalog';

function buildProduct(name: string, overrides: Partial<Product> = {}): Product {
  return {
    id: name.length,
    slug: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    name,
    description: '',
    sourceUrl: '',
    imageUrls: ['/produto.png'],
    category: { name: 'Perfumes Arabes', slug: 'perfumes-arabes', url: '' },
    variants: [],
    priceCents: 10000,
    compareAtPriceCents: null,
    pixPriceCents: null,
    totalStock: 1,
    available: true,
    importedAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectHomeFeaturedProducts', () => {
  it('prioritizes preferred available products and limits the home shelf', () => {
    const products = [
      buildProduct('Produto indisponivel', { available: false, totalStock: 0 }),
      buildProduct('Khamrah Lattafa'),
      buildProduct('Produto generico 1'),
      buildProduct('Yara Elixir'),
      buildProduct('Produto generico 2'),
      buildProduct('Asad Bourbon'),
      buildProduct('Produto generico 3'),
      buildProduct('Fakhar Gold'),
      buildProduct('Sabah Al Ward'),
      buildProduct('Ameerat Al Arab'),
      buildProduct('Produto generico 4'),
      buildProduct('Produto generico 5'),
    ];

    const selected = selectHomeFeaturedProducts(products, 4);

    expect(selected).toHaveLength(4);
    expect(selected.map((product) => product.name)).toEqual([
      'Yara Elixir',
      'Asad Bourbon',
      'Khamrah Lattafa',
      'Fakhar Gold',
    ]);
    expect(selected.every((product) => product.available)).toBe(true);
  });
});
