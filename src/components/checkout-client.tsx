'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { useCart } from '@/components/cart-provider';
import { createWhatsAppCheckout } from '@/lib/checkout-request';

export function CheckoutClient() {
  const { clearCart, items, updateQuantity } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function openWhatsAppCheckout(): Promise<void> {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { whatsappUrl } = await createWhatsAppCheckout(items);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setErrorMessage(
        'Nao consegui recalcular o pedido no Supabase. Tenta de novo em instantes.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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
                <span>Preco recalculado pelo Supabase no envio</span>
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
          <span>Total oficial</span>
          <strong>Calculado no servidor</strong>
        </div>

        {errorMessage ? <p className="checkout-error">{errorMessage}</p> : null}

        <div className="checkout-actions">
          <button
            className="button"
            type="button"
            disabled={isSubmitting}
            onClick={() => void openWhatsAppCheckout()}
          >
            {isSubmitting ? 'Recalculando...' : 'Enviar pedido no WhatsApp'}
          </button>
          <button className="button ghost" type="button" onClick={clearCart}>
            Limpar carrinho
          </button>
        </div>
      </div>
    </section>
  );
}
