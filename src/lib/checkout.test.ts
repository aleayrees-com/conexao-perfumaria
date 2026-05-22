import { buildWhatsAppOrderMessage, getCartTotal } from '@/lib/checkout';
import type { CartItem } from '@/types/catalog';

const cartItems: readonly CartItem[] = [
  {
    productSlug: 'sabah',
    productName: 'Sabah Al Ward',
    variantId: 1,
    variantLabel: '100ml',
    unitPriceCents: 41000,
    imageUrl: null,
    quantity: 2,
  },
];

describe('checkout helpers', () => {
  it('calculates cart total', () => {
    expect(getCartTotal(cartItems)).toBe(82000);
  });

  it('builds a WhatsApp order message with product and total', () => {
    const message = buildWhatsAppOrderMessage(cartItems);

    expect(message).toContain('Sabah Al Ward');
    expect(message).toContain('Qtd: 2');
    expect(message).toContain('Total estimado: R$ 820,00');
  });
});
