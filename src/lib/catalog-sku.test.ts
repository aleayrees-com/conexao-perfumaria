import { describe, expect, test } from 'vitest';

import { createCatalogSku } from './catalog-sku';

describe('createCatalogSku', () => {
  test('combines a normalized product name with a unique identifier', () => {
    expect(
      createCatalogSku(
        'Óleo & Âmbar 100ml',
        'e93a19cf-842d-4f8e-945d-111111111111',
      ),
    ).toBe('CX-OLEO-AMBAR-100ML-E93A19CF');
  });

  test('keeps the SKU concise for a long product name', () => {
    expect(
      createCatalogSku(
        'Perfume com uma descrição muito longa para o catálogo',
        'e93a19cf-842d-4f8e-945d-111111111111',
      ),
    ).toBe('CX-PERFUME-COM-UMA-DESCRICAO-M-E93A19CF');
  });
});
