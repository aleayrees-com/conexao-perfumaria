import { NextResponse } from 'next/server';

import { markInfinitePayOrderPaid } from '@/lib/order-payments';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const orderNsu = readString(body.order_nsu);
  const transactionNsu = readString(body.transaction_nsu);

  if (!orderNsu || !transactionNsu) {
    return NextResponse.json(
      { error: 'Webhook sem order_nsu ou transaction_nsu.' },
      { status: 400 },
    );
  }

  const result = await markInfinitePayOrderPaid({
    orderNumber: orderNsu,
    eventSourceUrl: request.url,
    payment: {
      invoiceSlug: readString(body.invoice_slug),
      amountCents: readNumber(body.amount),
      paidAmountCents: readNumber(body.paid_amount),
      installments: readNumber(body.installments),
      captureMethod: readString(body.capture_method),
      transactionNsu,
      receiptUrl: readString(body.receipt_url),
      rawPayload: body,
    },
  });

  if (result.status !== 'paid') {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
