import type { CartItem } from '@/types/catalog';

interface CheckoutPayloadItem {
  readonly variantId: number;
  readonly quantity: number;
}

export interface WhatsAppCheckoutResponse {
  readonly whatsappUrl: string;
}

export function buildCheckoutPayload(
  items: readonly CartItem[],
): readonly CheckoutPayloadItem[] {
  return items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));
}

export async function createWhatsAppCheckout(
  items: readonly CartItem[],
): Promise<WhatsAppCheckoutResponse> {
  const response = await fetch('/api/checkout/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: buildCheckoutPayload(items) }),
  });

  if (!response.ok) {
    throw new Error('Nao foi possivel recalcular o pedido no servidor.');
  }

  return (await response.json()) as WhatsAppCheckoutResponse;
}
