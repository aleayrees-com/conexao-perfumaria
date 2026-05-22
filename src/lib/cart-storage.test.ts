import { parseStoredCart } from '@/lib/cart-storage';

describe('cart storage', () => {
  it('sanitizes a valid stored cart item', () => {
    expect(
      parseStoredCart([
        {
          productSlug: ' perfume ',
          productName: 'Perfume',
          variantId: 123,
          variantLabel: 'Unico',
          unitPriceCents: 4100,
          imageUrl:
            'https://dcdn-us.mitiendanube.com/stores/006/426/258/products/item.webp',
          quantity: 2,
        },
      ]),
    ).toEqual([
      {
        productSlug: 'perfume',
        productName: 'Perfume',
        variantId: 123,
        variantLabel: 'Unico',
        unitPriceCents: 4100,
        imageUrl:
          'https://dcdn-us.mitiendanube.com/stores/006/426/258/products/item.webp',
        quantity: 2,
      },
    ]);
  });

  it('drops broken cart items', () => {
    expect(
      parseStoredCart([
        {
          productSlug: '',
          productName: 'Produto',
          variantId: 0,
          variantLabel: 'Unico',
          unitPriceCents: 4100,
          imageUrl: null,
          quantity: 1,
        },
      ]),
    ).toEqual([]);
  });

  it('removes unsupported image hosts and clamps quantity', () => {
    expect(
      parseStoredCart([
        {
          productSlug: 'produto',
          productName: 'Produto',
          variantId: 1,
          variantLabel: 'Unico',
          unitPriceCents: 4100,
          imageUrl: 'https://example.com/item.webp',
          quantity: 500,
        },
      ]),
    ).toEqual([
      {
        productSlug: 'produto',
        productName: 'Produto',
        variantId: 1,
        variantLabel: 'Unico',
        unitPriceCents: 4100,
        imageUrl: null,
        quantity: 99,
      },
    ]);
  });
});
