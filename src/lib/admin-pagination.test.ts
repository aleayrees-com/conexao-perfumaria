import { describe, expect, test } from 'vitest';

import {
  createAdminProductPageHref,
  createAdminProductPaginationPages,
  resolveAdminProductReturnPath,
} from './admin-pagination';

describe('createAdminProductPaginationPages', () => {
  test('returns every selectable page in the catalog', () => {
    expect(createAdminProductPaginationPages(16)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });
});

describe('createAdminProductPageHref', () => {
  test('keeps the active search and status when selecting a page', () => {
    expect(
      createAdminProductPageHref({
        page: 12,
        searchTerm: 'óleo & âmbar',
        statusFilter: 'active',
      }),
    ).toBe(
      '/admin/produtos?busca=%C3%B3leo+%26+%C3%A2mbar&status=active&pagina=12',
    );
  });
});

describe('resolveAdminProductReturnPath', () => {
  test('keeps a catalog return path and rejects an external destination', () => {
    expect(
      resolveAdminProductReturnPath('/admin/produtos?status=active&pagina=3'),
    ).toBe('/admin/produtos?status=active&pagina=3');
    expect(resolveAdminProductReturnPath('https://example.com')).toBe(
      '/admin/produtos',
    );
  });
});
