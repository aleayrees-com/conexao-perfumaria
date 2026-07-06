import 'server-only';

import { createHash } from 'node:crypto';

import { readMetaCapiEnv } from '@/lib/env';

export type MetaStandardEventName =
  | 'PageView'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

export interface MetaCapiItem {
  readonly id: string;
  readonly quantity: number;
  readonly item_price: number;
}

export interface MetaCapiEventInput {
  readonly eventId: string;
  readonly eventName: MetaStandardEventName;
  readonly eventSourceUrl: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly fbp: string | null;
  readonly fbc: string | null;
  readonly value?: number;
  readonly currency?: 'BRL';
  readonly contentIds?: readonly string[];
  readonly contents?: readonly MetaCapiItem[];
  readonly orderId?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
}

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function buildUserData(input: MetaCapiEventInput): Record<string, unknown> {
  const userData: Record<string, unknown> = {};

  if (input.email) {
    userData.em = [hashIdentifier(input.email)];
  }

  if (input.phone) {
    const normalizedPhone = normalizePhone(input.phone);

    if (normalizedPhone) {
      userData.ph = [hashIdentifier(normalizedPhone)];
    }
  }

  if (input.userAgent) {
    userData.client_user_agent = input.userAgent;
  }

  if (input.ipAddress) {
    userData.client_ip_address = input.ipAddress;
  }

  if (input.fbp) {
    userData.fbp = input.fbp;
  }

  if (input.fbc) {
    userData.fbc = input.fbc;
  }

  return userData;
}

function buildCustomData(input: MetaCapiEventInput): Record<string, unknown> {
  const customData: Record<string, unknown> = {};

  if (input.value !== undefined) {
    customData.value = input.value;
  }

  if (input.currency) {
    customData.currency = input.currency;
  }

  if (input.contentIds) {
    customData.content_ids = input.contentIds;
    customData.content_type = 'product';
  }

  if (input.contents) {
    customData.contents = input.contents;
  }

  if (input.orderId) {
    customData.order_id = input.orderId;
  }

  return customData;
}

export async function sendMetaCapiEvent(
  input: MetaCapiEventInput,
): Promise<{ readonly skipped: boolean; readonly response: unknown }> {
  const env = readMetaCapiEnv();

  if (!env) {
    return {
      skipped: true,
      response: { reason: 'META_CAPI_ACCESS_TOKEN ausente.' },
    };
  }

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: buildUserData(input),
        custom_data: buildCustomData(input),
      },
    ],
    test_event_code: env.testEventCode ?? undefined,
  };
  const response = await fetch(
    `https://graph.facebook.com/${env.graphApiVersion}/${env.pixelId}/events?access_token=${encodeURIComponent(env.accessToken)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(`Meta CAPI falhou com status ${response.status}.`);
  }

  return { skipped: false, response: responseBody };
}
