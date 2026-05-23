'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { parseStoredCart } from '@/lib/cart-storage';
import type { CartItem } from '@/types/catalog';

interface AddCartItemInput {
  readonly productSlug: string;
  readonly productName: string;
  readonly variantId: number;
  readonly variantLabel: string;
  readonly imageUrl: string | null;
}

interface CartContextValue {
  readonly items: readonly CartItem[];
  readonly isOpen: boolean;
  readonly totalItems: number;
  readonly addItem: (item: AddCartItemInput, quantity?: number) => void;
  readonly updateQuantity: (variantId: number, quantity: number) => void;
  readonly removeItem: (variantId: number) => void;
  readonly clearCart: () => void;
  readonly openCart: () => void;
  readonly closeCart: () => void;
}

const STORAGE_KEY = 'conexao-perfumaria-cart';
const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): readonly CartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const params = new URLSearchParams(window.location.search);

  if (params.has('resetCart')) {
    window.localStorage.removeItem(STORAGE_KEY);
    params.delete('resetCart');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);

    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return parseStoredCart(parsed);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);

    return [];
  }
}

export function CartProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [items, setItems] = useState<readonly CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setItems(readStoredCart());
      setHasHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hasHydrated, items]);

  const addItem = useCallback((item: AddCartItemInput, quantity = 1) => {
    setItems((currentItems) => {
      const existing = currentItems.find(
        (cartItem) => cartItem.variantId === item.variantId,
      );

      if (existing) {
        return currentItems.map((cartItem) =>
          cartItem.variantId === item.variantId
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem,
        );
      }

      return [...currentItems, { ...item, quantity }];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((variantId: number, quantity: number) => {
    setItems((currentItems) => {
      if (quantity <= 0) {
        return currentItems.filter((item) => item.variantId !== variantId);
      }

      return currentItems.map((item) =>
        item.variantId === variantId ? { ...item, quantity } : item,
      );
    });
  }, []);

  const removeItem = useCallback((variantId: number) => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.variantId !== variantId),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isOpen,
      totalItems,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      openCart,
      closeCart,
    }),
    [
      addItem,
      clearCart,
      closeCart,
      isOpen,
      items,
      openCart,
      removeItem,
      totalItems,
      updateQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart precisa estar dentro de CartProvider.');
  }

  return context;
}
