import {
  buildWhatsAppOrderMessage,
  getCartTotal,
  type CheckoutQuoteItem,
} from '@/lib/checkout';

const quoteItems: readonly CheckoutQuoteItem[] = [
  {
    productName: 'Sabah Al Ward',
    variantLabel: '100ml',
    unitPriceCents: 41000,
    quantity: 2,
  },
];

describe('checkout helpers', () => {
  it('calculates cart total', () => {
    expect(getCartTotal(quoteItems)).toBe(82000);
  });

  it('builds a WhatsApp order message with product and total', () => {
    const message = buildWhatsAppOrderMessage(quoteItems);

    expect(message).toContain('Sabah Al Ward');
    expect(message).toContain('Qtd: 2');
    expect(message).toContain('Total estimado: R$ 820,00');
    expect(message).toContain('catalogo oficial da loja');
  });
});
