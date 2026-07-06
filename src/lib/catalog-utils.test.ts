import {
  buildCategorySummaries,
  filterCatalogProducts,
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
        sku: 'YARA-100',
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

const skuOnlyProduct = {
  id: 3,
  slug: 'produto-teste-checkout-sku',
  name: 'Produto de Teste Checkout',
  description: 'Produto oculto para testar compra.',
  sourceUrl: 'https://example.com/produto-teste-checkout-sku',
  imageUrls: [],
  category: {
    name: 'Teste',
    slug: 'teste',
    url: 'https://example.com/teste',
  },
  variants: [
    {
      id: 30,
      sku: 'TESTE-COMPRA-000',
      label: 'Teste InfinitePay',
      priceCents: 100,
      compareAtPriceCents: null,
      pixPriceCents: null,
      stock: 1,
      available: true,
      imageUrl: null,
    },
  ],
  priceCents: 100,
  compareAtPriceCents: null,
  pixPriceCents: null,
  totalStock: 1,
  available: true,
  importedAt: '2026-06-19T00:00:00.000Z',
  catalogVisibility: 'sku_only',
} satisfies Product & { readonly catalogVisibility: 'sku_only' };

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

  it('searches public products by SKU', () => {
    expect(
      searchProducts(products, 'yara-100').map((product) => product.slug),
    ).toEqual(['yara']);
  });

  it('only reveals SKU-only products when searching the exact SKU', () => {
    const catalog = [...products, skuOnlyProduct];

    expect(searchProducts(catalog, '').map((product) => product.slug)).toEqual([
      'yara',
      'body-splash',
    ]);
    expect(searchProducts(catalog, 'Produto de Teste')).toEqual([]);
    expect(searchProducts(catalog, 'TESTE')).toEqual([]);
    expect(
      searchProducts(catalog, 'TESTE-COMPRA-000').map(
        (product) => product.slug,
      ),
    ).toEqual(['produto-teste-checkout-sku']);
  });

  it('filters catalog products by availability and maximum price', () => {
    expect(
      filterCatalogProducts(products, {
        categorySlug: 'todos',
        maxPriceCents: 3000,
        onlyAvailable: false,
        searchTerm: '',
      }).map((product) => product.slug),
    ).toEqual(['body-splash']);

    expect(
      filterCatalogProducts(products, {
        categorySlug: 'todos',
        maxPriceCents: 3000,
        onlyAvailable: true,
        searchTerm: '',
      }),
    ).toEqual([]);
  });
});
