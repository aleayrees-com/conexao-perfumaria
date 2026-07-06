'use client';

import type { CartItem, Product, ProductVariant } from '@/types/catalog';

export type TrackingEventName =
  | 'page_view'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase';

export interface EcommerceTrackingItem {
  readonly item_id: string;
  readonly item_name: string;
  readonly item_variant?: string;
  readonly item_category?: string;
  readonly price: number;
  readonly quantity: number;
}

export interface EcommerceTrackingPayload {
  readonly eventId: string;
  readonly currency: 'BRL';
  readonly value: number;
  readonly items: readonly EcommerceTrackingItem[];
  readonly transactionId?: string;
}

interface MetaPixelWindow extends Window {
  dataLayer?: unknown[];
  readonly gtag?: (
    command: 'event',
    eventName: string,
    payload: Record<string, unknown>,
  ) => void;
  readonly fbq?: (
    command: 'track',
    eventName: string,
    payload?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => void;
}

function getBrowserWindow(): MetaPixelWindow | null {
  return typeof window === 'undefined' ? null : (window as MetaPixelWindow);
}

function centsToUnit(value: number): number {
  return Math.round(value) / 100;
}

export function createTrackingEventId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function productToTrackingPayload({
  eventId,
  product,
  quantity,
  variant,
}: {
  readonly eventId: string;
  readonly product: Product;
  readonly quantity: number;
  readonly variant: ProductVariant;
}): EcommerceTrackingPayload {
  const price = centsToUnit(variant.priceCents);

  return {
    eventId,
    currency: 'BRL',
    value: price * quantity,
    items: [
      {
        item_id: variant.sku ?? String(variant.id),
        item_name: product.name,
        item_variant: variant.label,
        item_category: product.category?.name,
        price,
        quantity,
      },
    ],
  };
}

export function cartItemsToTrackingPayload({
  eventId,
  items,
  transactionId,
}: {
  readonly eventId: string;
  readonly items: readonly CartItem[];
  readonly transactionId?: string;
}): EcommerceTrackingPayload {
  const trackingItems = items.map((item) => ({
    item_id: item.sku ?? String(item.variantId),
    item_name: item.productName,
    item_variant: item.variantLabel,
    item_category: item.categoryName ?? undefined,
    price: centsToUnit(item.unitPriceCents),
    quantity: item.quantity,
  }));

  return {
    eventId,
    currency: 'BRL',
    value: trackingItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ),
    items: trackingItems,
    transactionId,
  };
}

function toMetaEventName(eventName: TrackingEventName): string {
  switch (eventName) {
    case 'add_to_cart':
      return 'AddToCart';
    case 'begin_checkout':
      return 'InitiateCheckout';
    case 'purchase':
      return 'Purchase';
    case 'page_view':
      return 'PageView';
  }
}

function pushDataLayerEvent(
  eventName: TrackingEventName,
  payload?: EcommerceTrackingPayload,
): void {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return;
  }

  const eventPayload = payload
    ? {
        event: eventName,
        event_id: payload.eventId,
        ecommerce: {
          currency: payload.currency,
          value: payload.value,
          transaction_id: payload.transactionId,
          items: payload.items,
        },
      }
    : { event: eventName };

  browserWindow.dataLayer = browserWindow.dataLayer ?? [];
  browserWindow.dataLayer.push(eventPayload);
}

function trackGa4Event(
  eventName: TrackingEventName,
  payload?: EcommerceTrackingPayload,
): void {
  const browserWindow = getBrowserWindow();

  if (!browserWindow?.gtag || !payload) {
    return;
  }

  browserWindow.gtag('event', eventName, {
    currency: payload.currency,
    value: payload.value,
    transaction_id: payload.transactionId,
    items: payload.items,
  });
}

function trackMetaPixelEvent(
  eventName: TrackingEventName,
  payload?: EcommerceTrackingPayload,
): void {
  const browserWindow = getBrowserWindow();

  if (!browserWindow?.fbq) {
    return;
  }

  if (!payload) {
    browserWindow.fbq('track', toMetaEventName(eventName));
    return;
  }

  browserWindow.fbq(
    'track',
    toMetaEventName(eventName),
    {
      content_ids: payload.items.map((item) => item.item_id),
      content_type: 'product',
      contents: payload.items.map((item) => ({
        id: item.item_id,
        quantity: item.quantity,
      })),
      currency: payload.currency,
      value: payload.value,
    },
    { eventID: payload.eventId },
  );
}

function sendServerSideMetaEvent(
  eventName: TrackingEventName,
  payload?: EcommerceTrackingPayload,
): void {
  const browserWindow = getBrowserWindow();

  if (
    !browserWindow ||
    !payload ||
    !['add_to_cart', 'begin_checkout', 'purchase'].includes(eventName)
  ) {
    return;
  }

  const body = {
    eventId: payload.eventId,
    eventName,
    eventSourceUrl: browserWindow.location.href,
    currency: payload.currency,
    value: payload.value,
    transactionId: payload.transactionId,
    items: payload.items,
  };

  if (browserWindow.navigator.sendBeacon) {
    browserWindow.navigator.sendBeacon(
      '/api/tracking/meta',
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
    );
    return;
  }

  void fetch('/api/tracking/meta', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

export function trackEcommerceEvent(
  eventName: TrackingEventName,
  payload?: EcommerceTrackingPayload,
): void {
  pushDataLayerEvent(eventName, payload);
  trackGa4Event(eventName, payload);
  trackMetaPixelEvent(eventName, payload);
  sendServerSideMetaEvent(eventName, payload);
}
