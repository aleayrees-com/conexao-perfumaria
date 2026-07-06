import type { ShippingQuote } from '@/lib/shipping';

export const STORE_PICKUP_SHIPPING_QUOTE: ShippingQuote = {
  id: 'store-pickup',
  provider: 'pickup',
  serviceName: 'Retirar em loja',
  priceCents: 0,
  deliveryMinDays: 0,
  deliveryMaxDays: 0,
  raw: {
    mode: 'store-pickup',
  },
};

export const STORE_PICKUP_ADDRESS = {
  cep: '',
  street: 'Retirada em loja',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  complement: null,
} as const;

export function isStorePickupShippingId(id: string): boolean {
  return id === STORE_PICKUP_SHIPPING_QUOTE.id;
}
