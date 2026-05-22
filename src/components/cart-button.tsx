'use client';

import { useCart } from '@/components/cart-provider';

export function CartButton() {
  const { openCart, totalItems } = useCart();

  return (
    <button className="cart-button" type="button" onClick={openCart}>
      <span>Carrinho</span>
      <strong>{totalItems}</strong>
    </button>
  );
}
