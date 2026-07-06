'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useCart } from '@/components/cart-provider';
import { formatMoney } from '@/lib/money';

export function CartDrawer() {
  const router = useRouter();
  const { clearCart, closeCart, isOpen, items, removeItem, updateQuantity } =
    useCart();
  const totalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="drawer-shell" role="dialog" aria-modal="true">
      <button
        className="drawer-backdrop"
        type="button"
        aria-label="Fechar carrinho"
        onClick={closeCart}
      />
      <aside className="cart-drawer">
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Pedido em montagem</p>
            <h2>Carrinho</h2>
          </div>
          <button className="icon-button" type="button" onClick={closeCart}>
            Fechar
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <p>Seu carrinho está pronto para receber uma fragrância.</p>
            <Link className="button ghost" href="/produtos" onClick={closeCart}>
              Ver catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {items.map((item) => (
                <article className="cart-line" key={item.variantId}>
                  {item.imageUrl ? (
                    <Image
                      alt=""
                      className="cart-line-image"
                      height={72}
                      src={item.imageUrl}
                      width={72}
                    />
                  ) : (
                    <div className="cart-line-image placeholder" />
                  )}
                  <div>
                    <h3>{item.productName}</h3>
                    <p>{item.variantLabel}</p>
                    <strong>
                      {formatMoney(item.unitPriceCents * item.quantity)}
                    </strong>
                    <div className="quantity-control">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.variantId, item.quantity - 1)
                        }
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.variantId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => removeItem(item.variantId)}
                    >
                      Remover
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="drawer-footer">
              <div className="cart-total">
                <span>Total do pedido</span>
                <strong>{formatMoney(totalCents)}</strong>
              </div>
              <button
                className="button full"
                type="button"
                onClick={() => {
                  closeCart();
                  router.push('/checkout');
                }}
              >
                Revisar pedido e calcular frete
              </button>
              <button className="text-button" type="button" onClick={clearCart}>
                Limpar carrinho
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
