import {
  buildMelhorEnvioQuotePayload,
  getFallbackShippingQuotes,
  parseMelhorEnvioQuotes,
} from '@/lib/shipping';

describe('shipping helpers', () => {
  it('returns a manual fallback quote from configured price', () => {
    const quotes = getFallbackShippingQuotes({
      destinationCep: '01001-000',
      totalCents: 15000,
    });

    expect(quotes).toEqual([
      expect.objectContaining({
        id: 'manual-standard',
        provider: 'manual',
        serviceName: 'Entrega combinada',
        priceCents: expect.any(Number),
      }),
    ]);
  });

  it('builds Melhor Envio product quote payload with kg and BRL units', () => {
    expect(
      buildMelhorEnvioQuotePayload({
        originCep: '77001000',
        destinationCep: '01001000',
        items: [
          {
            id: '123',
            widthCm: 8,
            heightCm: 12,
            lengthCm: 18,
            weightGrams: 250,
            insuranceCents: 12700,
            quantity: 2,
          },
        ],
      }),
    ).toEqual({
      from: { postal_code: '77001000' },
      to: { postal_code: '01001000' },
      products: [
        {
          id: '123',
          width: 8,
          height: 12,
          length: 18,
          weight: 0.25,
          insurance_value: 127,
          quantity: 2,
        },
      ],
      options: {
        receipt: false,
        own_hand: false,
      },
    });
  });

  it('normalizes Melhor Envio quotes using custom price and delivery range', () => {
    expect(
      parseMelhorEnvioQuotes([
        {
          id: 2,
          name: 'SEDEX',
          custom_price: '46.23',
          custom_delivery_range: { min: 3, max: 4 },
          company: { name: 'Correios' },
          packages: [{ format: 'box' }],
        },
      ]),
    ).toEqual([
      {
        id: 'melhor-envio-2',
        provider: 'melhor-envio',
        serviceId: 2,
        serviceName: 'Correios SEDEX',
        priceCents: 4623,
        deliveryMinDays: 3,
        deliveryMaxDays: 4,
        raw: {
          id: 2,
          name: 'SEDEX',
          custom_price: '46.23',
          custom_delivery_range: { min: 3, max: 4 },
          company: { name: 'Correios' },
          packages: [{ format: 'box' }],
        },
      },
    ]);
  });
});
