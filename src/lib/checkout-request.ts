import type { CartItem } from '@/types/catalog';

interface CheckoutPayloadItem {
  readonly variantId: number;
  readonly quantity: number;
}

export interface CheckoutCustomerPayload {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly marketingOptIn: boolean;
}

export interface CheckoutAddressPayload {
  readonly cep: string;
  readonly street: string;
  readonly number: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly complement?: string;
}

export interface CheckoutShippingOptionPayload {
  readonly id: string;
  readonly provider: 'manual' | 'melhor-envio' | 'pickup';
  readonly serviceId?: number;
  readonly serviceName: string;
  readonly priceCents: number;
  readonly deliveryMinDays: number | null;
  readonly deliveryMaxDays: number | null;
}

export interface CheckoutDetailsPayload {
  readonly customer: CheckoutCustomerPayload;
  readonly address?: CheckoutAddressPayload;
  readonly shippingOption: CheckoutShippingOptionPayload;
}

export interface CheckoutRequestPayload extends CheckoutDetailsPayload {
  readonly items: readonly CheckoutPayloadItem[];
}

export interface PaymentCheckoutResponse {
  readonly checkoutUrl: string;
  readonly whatsappUrl: string;
  readonly orderNumber?: string;
  readonly tracking?: {
    readonly eventId: string;
    readonly currency: 'BRL';
    readonly value: number;
    readonly items: readonly {
      readonly item_id: string;
      readonly item_name: string;
      readonly item_variant?: string;
      readonly item_category?: string;
      readonly price: number;
      readonly quantity: number;
    }[];
    readonly transactionId?: string;
  };
}

export function buildCheckoutPayload(
  items: readonly CartItem[],
): readonly CheckoutPayloadItem[];
export function buildCheckoutPayload(
  items: readonly CartItem[],
  details: CheckoutDetailsPayload,
): CheckoutRequestPayload;
export function buildCheckoutPayload(
  items: readonly CartItem[],
  details?: CheckoutDetailsPayload,
): readonly CheckoutPayloadItem[] | CheckoutRequestPayload {
  const payloadItems = items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));

  if (!details) {
    return payloadItems;
  }

  return {
    items: payloadItems,
    ...details,
  };
}

export async function createPaymentCheckout(
  items: readonly CartItem[],
  details: CheckoutDetailsPayload,
): Promise<PaymentCheckoutResponse> {
  const response = await fetch('/api/checkout/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildCheckoutPayload(items, details)),
  });

  if (!response.ok) {
    throw new Error('Não foi possível recalcular o pedido no servidor.');
  }

  return (await response.json()) as PaymentCheckoutResponse;
}
