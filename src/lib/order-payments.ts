import 'server-only';

import { createAdminClient } from '@/lib/admin-data';
import { sendMetaCapiEvent } from '@/lib/meta-capi';
import type { EcommerceTrackingPayload } from '@/lib/tracking';

type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

interface OrderPaymentRow extends Record<string, unknown> {
  readonly id: string;
  readonly order_number: string;
  readonly status: OrderStatus;
  readonly payment_status: PaymentStatus;
  readonly total_cents: number | string;
  readonly customer_email: string | null;
  readonly customer_phone: string | null;
  readonly metadata: Record<string, unknown> | null;
}

interface OrderPaymentItemRow extends Record<string, unknown> {
  readonly sku: string | null;
  readonly nuvemshop_variant_id: number | string | null;
  readonly product_name: string;
  readonly variant_label: string;
  readonly unit_price_cents: number | string;
  readonly quantity: number | string;
  readonly metadata?: Record<string, unknown> | null;
}

interface InfinitePayPaymentData {
  readonly invoiceSlug: string | null;
  readonly amountCents: number | null;
  readonly paidAmountCents: number | null;
  readonly installments: number | null;
  readonly captureMethod: string | null;
  readonly transactionNsu: string | null;
  readonly receiptUrl: string | null;
  readonly rawPayload: Record<string, unknown>;
}

export type MarkInfinitePayOrderPaidResult =
  | {
      readonly status: 'paid';
      readonly orderId: string;
      readonly orderNumber: string;
    }
  | {
      readonly status: 'missing_order' | 'amount_mismatch' | 'update_failed';
      readonly reason: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toInteger(value: unknown, field: string): number {
  const numberValue =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Valor numérico inválido em ${field}.`);
  }

  return numberValue;
}

function readMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function buildInfinitePayMetadata(
  payment: InfinitePayPaymentData,
): Record<string, unknown> {
  return {
    invoiceSlug: payment.invoiceSlug,
    amountCents: payment.amountCents,
    paidAmountCents: payment.paidAmountCents,
    installments: payment.installments,
    captureMethod: payment.captureMethod,
    transactionNsu: payment.transactionNsu,
    receiptUrl: payment.receiptUrl,
    rawPayload: payment.rawPayload,
    updatedAt: new Date().toISOString(),
  };
}

function getItemId(item: OrderPaymentItemRow): string {
  return item.sku ?? String(item.nuvemshop_variant_id ?? item.product_name);
}

function getItemCategory(item: OrderPaymentItemRow): string | undefined {
  const metadata = readMetadata(item.metadata);
  const categoryName = metadata.categoryName;

  return typeof categoryName === 'string' && categoryName.trim()
    ? categoryName
    : undefined;
}

async function readOrderAndItems(orderNumber: string): Promise<{
  readonly order: OrderPaymentRow;
  readonly items: readonly OrderPaymentItemRow[];
} | null> {
  const client = createAdminClient();
  const orderResponse = await client
    .from('orders')
    .select(
      'id,order_number,status,payment_status,total_cents,customer_email,customer_phone,metadata',
    )
    .eq('order_number', orderNumber)
    .single();

  if (orderResponse.error || !orderResponse.data) {
    return null;
  }

  const itemsResponse = await client
    .from('order_items')
    .select(
      'sku,nuvemshop_variant_id,product_name,variant_label,unit_price_cents,quantity,metadata',
    )
    .eq('order_id', orderResponse.data.id);

  if (itemsResponse.error) {
    return null;
  }

  return {
    order: orderResponse.data as OrderPaymentRow,
    items: (itemsResponse.data ?? []) as readonly OrderPaymentItemRow[],
  };
}

export async function getOrderPurchaseTrackingPayload(
  orderNumber: string,
): Promise<EcommerceTrackingPayload | null> {
  const data = await readOrderAndItems(orderNumber);

  if (!data || data.order.payment_status !== 'paid') {
    return null;
  }

  const items = data.items.map((item) => ({
    item_id: getItemId(item),
    item_name: item.product_name,
    item_variant: item.variant_label,
    item_category: getItemCategory(item),
    price:
      toInteger(item.unit_price_cents, 'order_items.unit_price_cents') / 100,
    quantity: toInteger(item.quantity, 'order_items.quantity'),
  }));

  return {
    eventId: `purchase_${data.order.order_number}`,
    currency: 'BRL',
    value: toInteger(data.order.total_cents, 'orders.total_cents') / 100,
    transactionId: data.order.order_number,
    items,
  };
}

export async function sendPurchaseForOrder({
  eventSourceUrl,
  orderNumber,
}: {
  readonly eventSourceUrl: string;
  readonly orderNumber: string;
}): Promise<void> {
  const data = await readOrderAndItems(orderNumber);

  if (!data) {
    return;
  }

  const contents = data.items.map((item) => ({
    id: getItemId(item),
    item_price:
      toInteger(item.unit_price_cents, 'order_items.unit_price_cents') / 100,
    quantity: toInteger(item.quantity, 'order_items.quantity'),
  }));
  const value = toInteger(data.order.total_cents, 'orders.total_cents') / 100;
  const eventId = `purchase_${orderNumber}`;
  const client = createAdminClient();

  try {
    const result = await sendMetaCapiEvent({
      eventId,
      eventName: 'Purchase',
      eventSourceUrl,
      userAgent: null,
      ipAddress: null,
      fbp: null,
      fbc: null,
      value,
      currency: 'BRL',
      contentIds: contents.map((item) => item.id),
      contents,
      orderId: orderNumber,
      email: data.order.customer_email,
      phone: data.order.customer_phone,
    });

    await client.from('tracking_events').upsert(
      {
        event_id: eventId,
        event_name: 'Purchase',
        order_id: data.order.id,
        payload: {
          contents,
          currency: 'BRL',
          orderNumber,
          value,
        },
        provider_response:
          typeof result.response === 'object' && result.response !== null
            ? (result.response as Record<string, unknown>)
            : { response: result.response },
        sent_at: result.skipped ? null : new Date().toISOString(),
        status: result.skipped ? 'skipped' : 'sent',
      },
      { onConflict: 'event_id' },
    );
  } catch (error: unknown) {
    await client.from('tracking_events').upsert(
      {
        event_id: eventId,
        event_name: 'Purchase',
        order_id: data.order.id,
        payload: {
          contents,
          currency: 'BRL',
          orderNumber,
          value,
        },
        provider_response: {
          error: error instanceof Error ? error.message : 'Erro desconhecido.',
        },
        sent_at: null,
        status: 'failed',
      },
      { onConflict: 'event_id' },
    );
  }
}

export async function markInfinitePayOrderPaid({
  eventSourceUrl,
  orderNumber,
  payment,
}: {
  readonly eventSourceUrl: string;
  readonly orderNumber: string;
  readonly payment: InfinitePayPaymentData;
}): Promise<MarkInfinitePayOrderPaidResult> {
  const data = await readOrderAndItems(orderNumber);

  if (!data) {
    return {
      status: 'missing_order',
      reason: 'Pedido não encontrado.',
    };
  }

  const totalCents = toInteger(data.order.total_cents, 'orders.total_cents');

  if (payment.amountCents !== null && payment.amountCents !== totalCents) {
    return {
      status: 'amount_mismatch',
      reason: 'Valor aprovado não corresponde ao pedido.',
    };
  }

  const client = createAdminClient();
  const metadata = readMetadata(data.order.metadata);
  const updatedMetadata = {
    ...metadata,
    infinitepay: buildInfinitePayMetadata(payment),
  };
  const updateResponse = await client
    .from('orders')
    .update({
      status: data.order.status === 'pending' ? 'confirmed' : data.order.status,
      payment_status: 'paid',
      payment_method: payment.captureMethod ?? 'infinitepay',
      paid_at: new Date().toISOString(),
      metadata: updatedMetadata,
    })
    .eq('id', data.order.id);

  if (updateResponse.error) {
    return {
      status: 'update_failed',
      reason: updateResponse.error.message,
    };
  }

  await client.from('order_events').insert({
    order_id: data.order.id,
    event_type: 'payment_paid',
    actor: 'infinitepay',
    metadata: {
      provider: 'infinitepay',
      ...buildInfinitePayMetadata(payment),
    },
  });

  await sendPurchaseForOrder({ eventSourceUrl, orderNumber });

  return {
    status: 'paid',
    orderId: data.order.id,
    orderNumber,
  };
}
