'use client';

import { useMemo, useState } from 'react';

import { useCart } from '@/components/cart-provider';
import { formatMoney } from '@/lib/money';
import type { Product, ProductVariant } from '@/types/catalog';

function getInitialVariant(product: Product): ProductVariant {
  return (
    product.variants.find((variant) => variant.available) ?? product.variants[0]
  );
}

export function ProductPurchasePanel({
  product,
}: {
  readonly product: Product;
}) {
  const { addItem } = useCart();
  const [variantId, setVariantId] = useState(
    () => getInitialVariant(product).id,
  );
  const [quantity, setQuantity] = useState(1);
  const selectedVariant = useMemo(
    () =>
      product.variants.find((variant) => variant.id === variantId) ??
      getInitialVariant(product),
    [product, variantId],
  );
  const canBuy = selectedVariant.available;

  return (
    <div className="purchase-panel">
      <label>
        Variacao
        <select
          value={variantId}
          onChange={(event) => setVariantId(Number(event.target.value))}
        >
          {product.variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.label} - {formatMoney(variant.priceCents)}
              {variant.available ? '' : ' (consultar)'}
            </option>
          ))}
        </select>
      </label>

      <label>
        Quantidade
        <input
          min={1}
          type="number"
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.max(1, Number(event.target.value) || 1))
          }
        />
      </label>

      <button
        className="button full"
        type="button"
        onClick={() =>
          addItem(
            {
              productSlug: product.slug,
              productName: product.name,
              variantId: selectedVariant.id,
              variantLabel: selectedVariant.label,
              unitPriceCents: selectedVariant.priceCents,
              imageUrl:
                selectedVariant.imageUrl ?? product.imageUrls[0] ?? null,
            },
            quantity,
          )
        }
      >
        {canBuy ? 'Adicionar ao carrinho' : 'Consultar no WhatsApp'}
      </button>
      <p>
        O pedido fecha direto com a equipe. Estoque, frete e PIX sao confirmados
        antes do pagamento.
      </p>
    </div>
  );
}
