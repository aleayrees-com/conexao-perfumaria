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
        sku: null,
        categoryName: null,
        unitPriceCents: 41000,
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

  it('includes customer, address and shipping option when provided', () => {
    const items: readonly CartItem[] = [
      {
        productSlug: 'sabah',
        productName: 'Sabah Al Ward',
        variantId: 123,
        variantLabel: '100ml',
        sku: null,
        categoryName: null,
        unitPriceCents: 41000,
        imageUrl: null,
        quantity: 1,
      },
    ];

    expect(
      buildCheckoutPayload(items, {
        customer: {
          name: 'Maria Souza',
          email: 'maria@example.com',
          phone: '11999990000',
          marketingOptIn: true,
        },
        address: {
          cep: '01001000',
          street: 'Praça da Sé',
          number: '100',
          neighborhood: 'Sé',
          city: 'São Paulo',
          state: 'SP',
          complement: 'Sala 1',
        },
        shippingOption: {
          id: 'manual-standard',
          provider: 'manual',
          serviceName: 'Entrega combinada',
          priceCents: 1990,
          deliveryMinDays: 2,
          deliveryMaxDays: 5,
        },
      }),
    ).toEqual({
      items: [
        {
          variantId: 123,
          quantity: 1,
        },
      ],
      customer: {
        name: 'Maria Souza',
        email: 'maria@example.com',
        phone: '11999990000',
        marketingOptIn: true,
      },
      address: {
        cep: '01001000',
        street: 'Praça da Sé',
        number: '100',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
        complement: 'Sala 1',
      },
      shippingOption: {
        id: 'manual-standard',
        provider: 'manual',
        serviceName: 'Entrega combinada',
        priceCents: 1990,
        deliveryMinDays: 2,
        deliveryMaxDays: 5,
      },
    });
  });

  it('allows store pickup checkout without shipping address', () => {
    const items: readonly CartItem[] = [
      {
        productSlug: 'sabah',
        productName: 'Sabah Al Ward',
        variantId: 123,
        variantLabel: '100ml',
        sku: null,
        categoryName: null,
        unitPriceCents: 41000,
        imageUrl: null,
        quantity: 1,
      },
    ];

    expect(
      buildCheckoutPayload(items, {
        customer: {
          name: 'Maria Souza',
          email: 'maria@example.com',
          phone: '11999990000',
          marketingOptIn: true,
        },
        shippingOption: {
          id: 'store-pickup',
          provider: 'pickup',
          serviceName: 'Retirar em loja',
          priceCents: 0,
          deliveryMinDays: 0,
          deliveryMaxDays: 0,
        },
      }),
    ).toEqual({
      items: [
        {
          variantId: 123,
          quantity: 1,
        },
      ],
      customer: {
        name: 'Maria Souza',
        email: 'maria@example.com',
        phone: '11999990000',
        marketingOptIn: true,
      },
      shippingOption: {
        id: 'store-pickup',
        provider: 'pickup',
        serviceName: 'Retirar em loja',
        priceCents: 0,
        deliveryMinDays: 0,
        deliveryMaxDays: 0,
      },
    });
  });
});
