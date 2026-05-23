import { buildCheckoutPayload } from '@/lib/checkout-request';
import type { CartItem } from '@/types/catalog';

describe('checkout request payload', () => {
  it('sends only variant ids and quantities to the server', () => {
    const items: readonly CartItem[] = [
      {
        productSlug: 'sabah',
        productName: 'Sabah Al Ward',
        variantId: 123,
        variantLabel: '100ml',
        imageUrl: null,
        quantity: 2,
      },
    ];

    expect(buildCheckoutPayload(items)).toEqual([
      {
        variantId: 123,
        quantity: 2,
      },
    ]);
  });
});
