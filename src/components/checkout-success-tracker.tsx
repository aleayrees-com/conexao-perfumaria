'use client';

import { useEffect } from 'react';

import { useCart } from '@/components/cart-provider';
import {
  type EcommerceTrackingPayload,
  trackEcommerceEvent,
} from '@/lib/tracking';

export function CheckoutSuccessTracker({
  tracking,
}: {
  readonly tracking: EcommerceTrackingPayload | null;
}) {
  const { clearCart } = useCart();

  useEffect(() => {
    if (!tracking) {
      return;
    }

    trackEcommerceEvent('purchase', tracking);
    clearCart();
  }, [clearCart, tracking]);

  return null;
}
