import {
  buildInfinitePayLinkPayload,
  extractInfinitePayCheckoutUrl,
} from '@/lib/infinitepay';

describe('InfinitePay helpers', () => {
  it('builds a checkout link payload with the Conexao handle', () => {
    expect(
      buildInfinitePayLinkPayload({
        orderNsu: '12345',
        redirectUrl:
          'https://conexaoimportados.com.br/api/payments/infinitepay/return',
        webhookUrl: 'https://conexaoimportados.com.br/api/webhooks/infinitepay',
        items: [
          {
            quantity: 2,
            price: 12700,
            description: 'Arabic Yara 25ml',
          },
        ],
      }),
    ).toEqual({
      handle: 'conexaoperfumaria',
      order_nsu: '12345',
      redirect_url:
        'https://conexaoimportados.com.br/api/payments/infinitepay/return',
      webhook_url: 'https://conexaoimportados.com.br/api/webhooks/infinitepay',
      items: [
        {
          quantity: 2,
          price: 12700,
          description: 'Arabic Yara 25ml',
        },
      ],
    });
  });

  it('passes customer and address to prefill InfinitePay checkout', () => {
    expect(
      buildInfinitePayLinkPayload({
        orderNsu: '12345',
        redirectUrl:
          'https://conexaoimportados.com.br/api/payments/infinitepay/return',
        webhookUrl: 'https://conexaoimportados.com.br/api/webhooks/infinitepay',
        customer: {
          name: 'Maria Souza',
          email: 'maria@example.com',
          phoneNumber: '+5511999990000',
        },
        address: {
          cep: '01001000',
          street: 'Praça da Sé',
          neighborhood: 'Sé',
          number: '100',
          complement: 'Sala 1',
        },
        items: [
          {
            quantity: 1,
            price: 10000,
            description: 'Produto',
          },
        ],
      }),
    ).toMatchObject({
      customer: {
        name: 'Maria Souza',
        email: 'maria@example.com',
        phone_number: '+5511999990000',
      },
      address: {
        cep: '01001000',
        street: 'Praça da Sé',
        neighborhood: 'Sé',
        number: '100',
        complement: 'Sala 1',
      },
    });
  });

  it('extracts checkout URLs from common InfinitePay response shapes', () => {
    expect(
      extractInfinitePayCheckoutUrl({
        data: {
          checkout_url: 'https://checkout.infinitepay.io/pay/abc',
        },
      }),
    ).toBe('https://checkout.infinitepay.io/pay/abc');

    expect(
      extractInfinitePayCheckoutUrl({
        paymentLink: 'https://checkout.infinitepay.io/pay/def',
      }),
    ).toBe('https://checkout.infinitepay.io/pay/def');
  });
});
