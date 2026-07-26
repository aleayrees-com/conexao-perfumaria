import { describe, expect, test } from 'vitest';

import {
  createAdminProductSortHref,
  parseAdminProductSortPreference,
} from './admin-product-sort-preferences';

describe('parseAdminProductSortPreference', () => {
  test('accepts a persisted catalog order', () => {
    expect(
      parseAdminProductSortPreference('{"field":"price","direction":"desc"}'),
    ).toEqual({ field: 'price', direction: 'desc' });
  });

  test('rejects malformed or unsupported stored values', () => {
    expect(
      parseAdminProductSortPreference('{"field":"client","direction":"asc"}'),
    ).toBeNull();
    expect(parseAdminProductSortPreference('{')).toBeNull();
  });
});

describe('createAdminProductSortHref', () => {
  test('sets the selected order and returns to the first page', () => {
    expect(
      createAdminProductSortHref('/admin/produtos?busca=amber&pagina=4', {
        field: 'stock',
        direction: 'desc',
      }),
    ).toBe('/admin/produtos?busca=amber&pagina=1&ordem=stock&direcao=desc');
  });
});
