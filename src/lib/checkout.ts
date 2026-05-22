import type { CartItem } from '@/types/catalog';
import { formatMoney } from '@/lib/money';

export function getCartTotal(items: readonly CartItem[]): number {
  return items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
}

export function buildWhatsAppOrderMessage(items: readonly CartItem[]): string {
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
  ].join('\n');
}

export function buildWhatsAppUrl(
  whatsappNumber: string,
  items: readonly CartItem[],
): string {
  const message = encodeURIComponent(buildWhatsAppOrderMessage(items));

  return `https://wa.me/${whatsappNumber}?text=${message}`;
}
