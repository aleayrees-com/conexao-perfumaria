import { NextResponse } from 'next/server';

import { sendMetaCapiEvent, type MetaStandardEventName } from '@/lib/meta-capi';
import {
  checkRateLimit,
  hasAllowedOrigin,
  readClientIp,
} from '@/lib/request-guard';

export const dynamic = 'force-dynamic';

interface TrackingRequestItem {
  readonly item_id: string;
  readonly price: number;
  readonly quantity: number;
}

interface TrackingRequestBody {
  readonly eventId: string;
  readonly eventName: 'add_to_cart' | 'begin_checkout' | 'purchase';
  readonly eventSourceUrl: string;
  readonly currency: 'BRL';
  readonly value: number;
  readonly transactionId?: string;
  readonly items: readonly TrackingRequestItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTrackingEventName(
  value: unknown,
): value is TrackingRequestBody['eventName'] {
  return (
    value === 'add_to_cart' ||
    value === 'begin_checkout' ||
    value === 'purchase'
  );
}

function toMetaEventName(
  eventName: TrackingRequestBody['eventName'],
): MetaStandardEventName {
  switch (eventName) {
    case 'add_to_cart':
      return 'AddToCart';
    case 'begin_checkout':
      return 'InitiateCheckout';
    case 'purchase':
      return 'Purchase';
  }
}

function parseBody(value: unknown): TrackingRequestBody | null {
  if (!isRecord(value) || !isTrackingEventName(value.eventName)) {
    return null;
  }

  if (
    typeof value.eventId !== 'string' ||
    typeof value.eventSourceUrl !== 'string' ||
    value.currency !== 'BRL' ||
    typeof value.value !== 'number' ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const items = value.items.flatMap((item): TrackingRequestItem[] => {
    if (
      !isRecord(item) ||
      typeof item.item_id !== 'string' ||
      typeof item.price !== 'number' ||
      typeof item.quantity !== 'number'
    ) {
      return [];
    }

    return [
      {
        item_id: item.item_id,
        price: item.price,
        quantity: Math.max(1, Math.trunc(item.quantity)),
      },
    ];
  });

  if (items.length === 0) {
    return null;
  }

  return {
    eventId: value.eventId,
    eventName: value.eventName,
    eventSourceUrl: value.eventSourceUrl,
    currency: 'BRL',
    value: value.value,
    transactionId:
      typeof value.transactionId === 'string' ? value.transactionId : undefined,
    items,
  };
}

async function readRequestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');

  if (!cookie) {
    return null;
  }

  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: 'Origem invalida.' }, { status: 403 });
  }

  const clientIp = readClientIp(request.headers);
  const rateLimit = checkRateLimit({
    key: `tracking:${clientIp}`,
    limit: 160,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitos eventos em pouco tempo.' },
      {
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
        status: 429,
      },
    );
  }

  const body = parseBody(await readRequestJson(request));

  if (!body) {
    return NextResponse.json({ error: 'Evento invalido.' }, { status: 400 });
  }

  try {
    const result = await sendMetaCapiEvent({
      eventId: body.eventId,
      eventName: toMetaEventName(body.eventName),
      eventSourceUrl: body.eventSourceUrl,
      userAgent: request.headers.get('user-agent'),
      ipAddress: clientIp,
      fbp: readCookie(request, '_fbp'),
      fbc: readCookie(request, '_fbc'),
      value: body.value,
      currency: body.currency,
      contentIds: body.items.map((item) => item.item_id),
      contents: body.items.map((item) => ({
        id: item.item_id,
        item_price: item.price,
        quantity: item.quantity,
      })),
      orderId: body.transactionId,
    });

    return NextResponse.json({ ok: true, skipped: result.skipped });
  } catch {
    return NextResponse.json(
      { error: 'Falha ao enviar evento para Meta.' },
      { status: 502 },
    );
  }
}
