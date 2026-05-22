import {
  buildCategorySummaries,
  searchProducts,
  sortFeaturedProducts,
} from '@/lib/catalog-utils';
import type { Product } from '@/types/catalog';

const products: readonly Product[] = [
  {
    id: 1,
    slug: 'yara',
    name: 'Yara',
    description: 'Perfume arabe',
    sourceUrl: 'https://example.com/yara',
    imageUrls: [],
    category: {
      name: 'Arabes',
      slug: 'arabes',
      url: 'https://example.com/arabes',
    },
    variants: [
      {
        id: 10,
        sku: null,
        label: '100ml',
        priceCents: 4100,
        compareAtPriceCents: null,
        pixPriceCents: null,
        stock: 2,
        available: true,
        imageUrl: null,
      },
    ],
    priceCents: 4100,
    compareAtPriceCents: null,
    pixPriceCents: null,
    totalStock: 2,
    available: true,
    importedAt: '2026-05-21T20:37:28.955Z',
  },
  {
    id: 2,
    slug: 'body-splash',
    name: 'Body Splash',
    description: 'Splash floral',
    sourceUrl: 'https://example.com/body-splash',
    imageUrls: [],
    category: {
      name: 'Body Splash',
      slug: 'body-splash',
      url: 'https://example.com/body-splash',
    },
    variants: [
      {
        id: 20,
        sku: null,
        label: '200ml',
        priceCents: 2900,
        compareAtPriceCents: null,
        pixPriceCents: null,
        stock: 0,
        available: false,
        imageUrl: null,
      },
    ],
    priceCents: 2900,
    compareAtPriceCents: null,
    pixPriceCents: null,
    totalStock: 0,
    available: false,
    importedAt: '2026-05-21T20:37:28.955Z',
  },
];

describe('catalog utils', () => {
  it('prioritizes available featured products', () => {
    expect(
      sortFeaturedProducts(products).map((product) => product.slug),
    ).toEqual(['yara', 'body-splash']);
  });

  it('builds category summaries from products', () => {
    expect(buildCategorySummaries(products)).toEqual([
      {
        name: 'Arabes',
        slug: 'arabes',
        url: 'https://example.com/arabes',
        productCount: 1,
        availableCount: 1,
      },
      {
        name: 'Body Splash',
        slug: 'body-splash',
        url: 'https://example.com/body-splash',
        productCount: 1,
        availableCount: 0,
      },
    ]);
  });

  it('searches by product, category and variant text', () => {
    expect(searchProducts(products, '100ml')).toHaveLength(1);
    expect(searchProducts(products, 'arabes')).toHaveLength(1);
  });
});
