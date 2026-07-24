'use server';

import { redirect } from 'next/navigation';

import { createAdminClient, insertAdminAuditLog } from '@/lib/admin-data';
import { requireAdmin } from '@/lib/admin-auth';
import { sendMetaCapiEvent } from '@/lib/meta-capi';

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readNullableString(formData: FormData, key: string): string | null {
  const value = readString(formData, key);

  return value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOrderStatus(
  value: string,
):
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded' {
  const allowed = [
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ] as const;

  return allowed.find((status) => status === value) ?? 'pending';
}

function readPaymentStatus(
  value: string,
):
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled' {
  const allowed = [
    'unpaid',
    'pending',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'cancelled',
  ] as const;

  return allowed.find((status) => status === value) ?? 'pending';
}

async function sendPurchaseIfNeeded({
  orderId,
  orderNumber,
}: {
  readonly orderId: string;
  readonly orderNumber: string;
}): Promise<void> {
  const client = createAdminClient();
  const orderResponse = await client
    .from('orders')
    .select('total_cents,customer_email,customer_phone')
    .eq('id', orderId)
    .single();
  const itemsResponse = await client
    .from('order_items')
    .select('sku,nuvemshop_variant_id,unit_price_cents,quantity')
    .eq('order_id', orderId);

  if (orderResponse.error || itemsResponse.error || !orderResponse.data) {
    return;
  }

  const value =
    Number.parseInt(String(orderResponse.data.total_cents), 10) / 100;
  const contents = (itemsResponse.data ?? []).map((item) => ({
    id: item.sku ?? String(item.nuvemshop_variant_id),
    item_price: Number.parseInt(String(item.unit_price_cents), 10) / 100,
    quantity: Number.parseInt(String(item.quantity), 10),
  }));

  const eventId = `purchase_${orderNumber}`;

  try {
    const result = await sendMetaCapiEvent({
      eventId,
      eventName: 'Purchase',
      eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://conexaoimportados.com.br'}/admin/pedidos/${orderNumber}`,
      userAgent: null,
      ipAddress: null,
      fbp: null,
      fbc: null,
      value,
      currency: 'BRL',
      contentIds: contents.map((item) => item.id),
      contents,
      orderId: orderNumber,
      email:
        typeof orderResponse.data.customer_email === 'string'
          ? orderResponse.data.customer_email
          : null,
      phone:
        typeof orderResponse.data.customer_phone === 'string'
          ? orderResponse.data.customer_phone
          : null,
    });

    await client.from('tracking_events').upsert(
      {
        event_id: eventId,
        event_name: 'Purchase',
        order_id: orderId,
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
        order_id: orderId,
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

export async function updateOrderAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const orderId = readString(formData, 'orderId');
  const orderNumber = readString(formData, 'orderNumber');
  const status = readOrderStatus(readString(formData, 'status'));
  const paymentStatus = readPaymentStatus(
    readString(formData, 'paymentStatus'),
  );
  const client = createAdminClient();
  const metadataResponse = await client
    .from('orders')
    .select('metadata')
    .eq('id', orderId)
    .single();
  const currentMetadata =
    metadataResponse.error || !isRecord(metadataResponse.data?.metadata)
      ? {}
      : metadataResponse.data.metadata;
  const currentShipping = isRecord(currentMetadata.shipping)
    ? currentMetadata.shipping
    : {};
  const trackingCode = readNullableString(formData, 'trackingCode');
  const shippingLabelUrl = readNullableString(formData, 'shippingLabelUrl');
  const nextMetadata = {
    ...currentMetadata,
    shipping: {
      ...currentShipping,
      trackingCode,
      labelUrl: shippingLabelUrl,
      adminUpdatedAt: new Date().toISOString(),
    },
  };
  const response = await client
    .from('orders')
    .update({
      status,
      payment_status: paymentStatus,
      admin_notes: readString(formData, 'adminNotes'),
      paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
      metadata: nextMetadata,
    })
    .eq('id', orderId);

  if (response.error) {
    throw new Error(response.error.message);
  }

  await client.from('order_events').insert({
    order_id: orderId,
    event_type: 'admin_update',
    actor: actor.displayName,
    metadata: { status, paymentStatus, shippingLabelUrl, trackingCode },
  });

  await insertAdminAuditLog(client, {
    actor,
    action: 'order_updated',
    entityType: 'orders',
    entityId: orderId,
    metadata: {
      orderNumber,
      paymentStatus,
      shippingLabelUrl,
      status,
      trackingCode,
    },
  });

  if (paymentStatus === 'paid') {
    await sendPurchaseIfNeeded({ orderId, orderNumber });
  }

  redirect(`/admin/pedidos/${orderNumber}`);
}
