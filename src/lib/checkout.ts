import { formatMoney } from '@/lib/money';

export interface CheckoutQuoteItem {
  readonly productName: string;
  readonly variantLabel: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
}

export function getCartTotal(items: readonly CheckoutQuoteItem[]): number {
  return items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
}

export function buildWhatsAppOrderMessage(
  items: readonly CheckoutQuoteItem[],
  orderNumber?: string,
): string {
  const lines = items.flatMap((item, index) => [
    `${index + 1}. ${item.productName}`,
    `Variação: ${item.variantLabel}`,
    `Qtd: ${item.quantity}`,
    `Subtotal: ${formatMoney(item.unitPriceCents * item.quantity)}`,
  ]);

  return [
    'Oi, Conexão Perfumaria. Quero fechar este pedido:',
    orderNumber ? `Pedido: ${orderNumber}` : '',
    '',
    ...lines,
    '',
    `Total estimado: ${formatMoney(getCartTotal(items))}`,
    '',
    'Pode confirmar disponibilidade, frete e melhor forma de pagamento pra mim?',
    '',
    'Pedido montado pelo catálogo da Conexão Perfumaria.',
  ]
    .filter((line, index) => line !== '' || index > 1)
    .join('\n');
}

export function buildWhatsAppUrl(
  whatsappNumber: string,
  items: readonly CheckoutQuoteItem[],
  orderNumber?: string,
): string {
  const message = encodeURIComponent(
    buildWhatsAppOrderMessage(items, orderNumber),
  );

  return `https://wa.me/${whatsappNumber}?text=${message}`;
}
