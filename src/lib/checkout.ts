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
): string {
  const lines = items.flatMap((item, index) => [
    `${index + 1}. ${item.productName}`,
    `Variacao: ${item.variantLabel}`,
    `Qtd: ${item.quantity}`,
    `Subtotal: ${formatMoney(item.unitPriceCents * item.quantity)}`,
  ]);

  return [
    'Oi, Conexao Perfumaria. Quero fechar este pedido:',
    '',
    ...lines,
    '',
    `Total estimado: ${formatMoney(getCartTotal(items))}`,
    '',
    'Pode confirmar estoque, frete e PIX pra mim?',
    '',
    'Obs.: valores recalculados pelo catalogo oficial da loja no momento do envio.',
  ].join('\n');
}

export function buildWhatsAppUrl(
  whatsappNumber: string,
  items: readonly CheckoutQuoteItem[],
): string {
  const message = encodeURIComponent(buildWhatsAppOrderMessage(items));

  return `https://wa.me/${whatsappNumber}?text=${message}`;
}
