'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useCart } from '@/components/cart-provider';
import { buildWhatsAppUrl, getCartTotal } from '@/lib/checkout';
import { publicEnv } from '@/lib/env';
import { formatMoney } from '@/lib/money';

export function CheckoutClient() {
  const { clearCart, items, updateQuantity } = useCart();
  const total = getCartTotal(items);
  const whatsappUrl = buildWhatsAppUrl(publicEnv.whatsappNumber, items);

  if (items.length === 0) {
    return (
      <section className="checkout-shell">
        <div className="empty-state wide">
          <p>O carrinho esta vazio. Bora colocar produto pra vender de novo.</p>
          <Link className="button" href="/produtos">
            Abrir catalogo
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="checkout-shell">
      <div className="checkout-card">
        <div>
          <p className="eyebrow">Checkout sem Nuvemshop</p>
          <h1>Revise e mande o pedido para o WhatsApp</h1>
          <p>
            A equipe confirma estoque, frete e chave PIX antes de receber. Nada
            passa pelo checkout bloqueado.
          </p>
        </div>

        <div className="checkout-lines">
          {items.map((item) => (
            <article className="checkout-line" key={item.variantId}>
              {item.imageUrl ? (
                <Image
                  alt=""
                  className="cart-line-image"
                  height={88}
                  src={item.imageUrl}
                  width={88}
                />
              ) : (
                <div className="cart-line-image placeholder" />
              )}
              <div>
                <h2>{item.productName}</h2>
                <p>{item.variantLabel}</p>
                <span>{formatMoney(item.unitPriceCents)}</span>
              </div>
              <input
                aria-label={`Quantidade de ${item.productName}`}
                min={1}
                type="number"
                value={item.quantity}
                onChange={(event) =>
                  updateQuantity(
                    item.variantId,
                    Math.max(1, Number(event.target.value) || 1),
                  )
                }
              />
            </article>
          ))}
        </div>

        <div className="checkout-total">
          <span>Total estimado</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <div className="checkout-actions">
          <a className="button" href={whatsappUrl} target="_blank">
            Enviar pedido no WhatsApp
          </a>
          <button className="button ghost" type="button" onClick={clearCart}>
            Limpar carrinho
          </button>
        </div>
      </div>
    </section>
  );
}
