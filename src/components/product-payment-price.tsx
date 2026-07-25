import type { JSX } from 'react';

import { formatMoney, getInstallmentText } from '@/lib/money';

interface ProductPaymentPriceProps {
  readonly className: string;
  readonly pixPriceCents: number | null;
  readonly priceCents: number;
}

/**
 * Shows a product's card, installment, and optional PIX price consistently.
 *
 * @example <ProductPaymentPrice className="price-stack" priceCents={29990} pixPriceCents={28491} />
 */
export function ProductPaymentPrice({
  className,
  pixPriceCents,
  priceCents,
}: ProductPaymentPriceProps): JSX.Element {
  return (
    <div className={className}>
      <strong className="payment-card-price">{formatMoney(priceCents)}</strong>
      <span>{getInstallmentText(priceCents)}</span>
      {pixPriceCents ? (
        <small className="payment-pix-price">
          {formatMoney(pixPriceCents)} no PIX
        </small>
      ) : null}
    </div>
  );
}
