import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { ProductPaymentPrice } from '@/components/product-payment-price';

describe('ProductPaymentPrice', () => {
  it('labels card and PIX values independently', () => {
    const markup = renderToStaticMarkup(
      createElement(ProductPaymentPrice, {
        className: 'price-stack',
        pixPriceCents: 28491,
        priceCents: 29990,
      }),
    );

    expect(markup).toContain('class="payment-card-price"');
    expect(markup).toContain('class="payment-pix-price"');
    expect(markup).toContain('R$ 284,91 no PIX');
  });
});
