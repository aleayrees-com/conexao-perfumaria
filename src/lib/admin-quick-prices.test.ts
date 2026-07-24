import { describe, expect, test } from 'vitest';

import {
  createAdminPriceUpdateIds,
  updateAdminPriceChanges,
} from './admin-quick-prices';

describe('createAdminPriceUpdateIds', () => {
  test('keeps each edited product once and drops empty form entries', () => {
    expect(
      createAdminPriceUpdateIds(['product-1', ' product-2 ', '', 'product-1']),
    ).toEqual(['product-1', 'product-2']);
  });
});

describe('updateAdminPriceChanges', () => {
  test('marks a changed price and removes it after restoring the original', () => {
    const changedPrices = updateAdminPriceChanges(
      {},
      'product-1',
      10_000,
      9500,
    );

    expect(changedPrices).toEqual({ 'product-1': 9500 });
    expect(
      updateAdminPriceChanges(changedPrices, 'product-1', 10_000, 10_000),
    ).toEqual({});
  });
});
