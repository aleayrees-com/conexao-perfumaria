import { STORE_PICKUP_SHIPPING_QUOTE } from '@/lib/store-pickup';

describe('store pickup option', () => {
  it('uses a free pickup quote that can be selected at checkout', () => {
    expect(STORE_PICKUP_SHIPPING_QUOTE).toEqual({
      id: 'store-pickup',
      provider: 'pickup',
      serviceName: 'Retirar em loja',
      priceCents: 0,
      deliveryMinDays: 0,
      deliveryMaxDays: 0,
      raw: {
        mode: 'store-pickup',
      },
    });
  });
});
