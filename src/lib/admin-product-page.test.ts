import { describe, expect, test } from 'vitest';

import {
  createAdminProductPage,
  resolveAdminProductSortField,
} from './admin-product-page';

const products = [
  { id: '1', name: 'Zafir', categoryName: 'Perfumes' },
  { id: '2', name: 'Âmbar', categoryName: 'Árabes' },
  { id: '3', name: 'Ameer', categoryName: 'Árabes' },
  { id: '4', name: 'Sem categoria', categoryName: 'Sem categoria' },
];

describe('createAdminProductPage', () => {
  test('sorts by category and product name before slicing the requested page', () => {
    const page = createAdminProductPage(products, {
      page: 1,
      pageSize: 2,
      searchTerm: '',
    });

    expect(page.items.map((product) => product.id)).toEqual(['2', '3']);
    expect(page.totalItems).toBe(4);
    expect(page.totalPages).toBe(2);
  });

  test('matches searches ignoring accents and clamps an out-of-range page', () => {
    const page = createAdminProductPage(products, {
      page: 9,
      pageSize: 25,
      searchTerm: 'ambar',
    });

    expect(page.items.map((product) => product.id)).toEqual(['2']);
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(1);
  });

  test('falls back to a valid page and page size', () => {
    const page = createAdminProductPage(products, {
      page: Number.NaN,
      pageSize: 0,
      searchTerm: '',
    });

    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(4);
  });

  test('sorts PIX prices from highest to lowest before paginating', () => {
    const page = createAdminProductPage(
      [
        { id: '1', name: 'Âmbar', categoryName: 'Árabes', pixPriceCents: 8500 },
        {
          id: '2',
          name: 'Zafir',
          categoryName: 'Perfumes',
          pixPriceCents: 14500,
        },
        {
          id: '3',
          name: 'Ameer',
          categoryName: 'Árabes',
          pixPriceCents: 12000,
        },
      ],
      {
        page: 1,
        pageSize: 2,
        searchTerm: '',
        sortDirection: 'desc',
        sortField: 'price',
      },
    );

    expect(page.items.map((product) => product.id)).toEqual(['2', '3']);
  });
});

describe('resolveAdminProductSortField', () => {
  test('uses the catalog default when a query value is unsupported', () => {
    expect(resolveAdminProductSortField('stock')).toBe('stock');
    expect(resolveAdminProductSortField('cliente')).toBe('category');
  });
});
