import { describe, expect, test } from 'vitest';

import { createCatalogSlug } from './catalog-slug';

describe('createCatalogSlug', () => {
  test('creates a URL-safe slug from a product name', () => {
    expect(createCatalogSlug('Ameerat Al Arab Princess – 100ml')).toBe(
      'ameerat-al-arab-princess-100ml',
    );
  });

  test('uses a safe fallback when no letters or numbers are supplied', () => {
    expect(createCatalogSlug('***')).toBe('novo-produto');
  });
});
