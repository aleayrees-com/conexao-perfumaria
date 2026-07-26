import { describe, expect, test } from 'vitest';

import {
  createProductImageStoragePath,
  validateProductImageBatch,
} from './admin-product-images';

describe('validateProductImageBatch', () => {
  test('accepts a supported image batch within the upload limit', () => {
    expect(() =>
      validateProductImageBatch([
        { name: 'frasco.webp', size: 1000, type: 'image/webp' },
      ]),
    ).not.toThrow();
  });

  test('rejects unsupported and oversized uploads', () => {
    expect(() =>
      validateProductImageBatch([
        { name: 'produto.gif', size: 1000, type: 'image/gif' },
      ]),
    ).toThrow('Image "produto.gif" must be JPEG, PNG, or WebP.');
    expect(() =>
      validateProductImageBatch([
        { name: 'produto.png', size: 5_242_881, type: 'image/png' },
      ]),
    ).toThrow('Image "produto.png" exceeds the 5 MB upload limit.');
  });
});

describe('createProductImageStoragePath', () => {
  test('creates a product-scoped, URL-safe storage path', () => {
    expect(
      createProductImageStoragePath(
        'product-1',
        'Frasco Árabe 100ml.png',
        'x1',
      ),
    ).toBe('product-1/x1-frasco-arabe-100ml.png');
  });
});
