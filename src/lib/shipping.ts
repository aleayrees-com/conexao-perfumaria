export type ShippingProvider = 'manual' | 'melhor-envio' | 'pickup';

export interface ShippingQuote {
  readonly id: string;
  readonly provider: ShippingProvider;
  readonly serviceId?: number;
  readonly serviceName: string;
  readonly priceCents: number;
  readonly deliveryMinDays: number | null;
  readonly deliveryMaxDays: number | null;
  readonly raw?: Record<string, unknown>;
}

export interface ShippingQuoteItem {
  readonly id: string;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly lengthCm: number;
  readonly weightGrams: number;
  readonly insuranceCents: number;
  readonly quantity: number;
}

export interface MelhorEnvioQuoteInput {
  readonly originCep: string;
  readonly destinationCep: string;
  readonly items: readonly ShippingQuoteItem[];
}

export interface MelhorEnvioQuotePayload {
  readonly from: {
    readonly postal_code: string;
  };
  readonly to: {
    readonly postal_code: string;
  };
  readonly products: readonly {
    readonly id: string;
    readonly width: number;
    readonly height: number;
    readonly length: number;
    readonly weight: number;
    readonly insurance_value: number;
    readonly quantity: number;
  }[];
  readonly options: {
    readonly receipt: false;
    readonly own_hand: false;
  };
}

interface ShippingEnv {
  readonly melhorEnvioAccessToken: string | null;
  readonly melhorEnvioBaseUrl: string;
  readonly melhorEnvioOriginCep: string | null;
  readonly melhorEnvioUserAgent: string;
  readonly fallbackPriceCents: number;
  readonly fallbackMinDays: number;
  readonly fallbackMaxDays: number;
}

function readOptionalString(value: string | undefined): string | null {
  return value?.trim() || null;
}

function readIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readShippingEnv(): ShippingEnv {
  return {
    melhorEnvioAccessToken: readOptionalString(
      process.env.MELHOR_ENVIO_ACCESS_TOKEN,
    ),
    melhorEnvioBaseUrl:
      readOptionalString(process.env.MELHOR_ENVIO_BASE_URL) ??
      'https://melhorenvio.com.br',
    melhorEnvioOriginCep: readOptionalString(
      process.env.MELHOR_ENVIO_ORIGIN_CEP,
    ),
    melhorEnvioUserAgent:
      readOptionalString(process.env.MELHOR_ENVIO_USER_AGENT) ??
      'Conexao Perfumaria (suporte@conexaoimportados.com.br)',
    fallbackPriceCents: readIntegerEnv('DEFAULT_SHIPPING_CENTS', 1990),
    fallbackMinDays: readIntegerEnv('DEFAULT_SHIPPING_MIN_DAYS', 2),
    fallbackMaxDays: readIntegerEnv('DEFAULT_SHIPPING_MAX_DAYS', 7),
  };
}

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

function centsToCurrency(value: number): number {
  return Math.round(value) / 100;
}

function gramsToKilograms(value: number): number {
  return Math.max(1, value) / 1000;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.replace(',', '.'));

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readInteger(value: unknown): number | null {
  const parsed = readNumber(value);

  return parsed === null ? null : Math.trunc(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readNestedRange(value: Record<string, unknown>): {
  readonly min: number | null;
  readonly max: number | null;
} {
  const customRange = isRecord(value.custom_delivery_range)
    ? value.custom_delivery_range
    : null;
  const defaultRange = isRecord(value.delivery_range)
    ? value.delivery_range
    : null;
  const range = customRange ?? defaultRange;

  return {
    min: range ? readInteger(range.min) : readInteger(value.delivery_time),
    max: range
      ? readInteger(range.max)
      : readInteger(value.custom_delivery_time ?? value.delivery_time),
  };
}

export function getFallbackShippingQuotes({
  destinationCep,
}: {
  readonly destinationCep: string;
  readonly totalCents: number;
}): readonly ShippingQuote[] {
  const env = readShippingEnv();
  const normalizedCep = normalizeCep(destinationCep);

  return [
    {
      id: 'manual-standard',
      provider: 'manual',
      serviceName: 'Entrega combinada',
      priceCents: env.fallbackPriceCents,
      deliveryMinDays: env.fallbackMinDays,
      deliveryMaxDays: env.fallbackMaxDays,
      raw: {
        destinationCep: normalizedCep,
        mode: 'fallback',
      },
    },
  ];
}

export function buildMelhorEnvioQuotePayload(
  input: MelhorEnvioQuoteInput,
): MelhorEnvioQuotePayload {
  return {
    from: {
      postal_code: normalizeCep(input.originCep),
    },
    to: {
      postal_code: normalizeCep(input.destinationCep),
    },
    products: input.items.map((item) => ({
      id: item.id,
      width: item.widthCm,
      height: item.heightCm,
      length: item.lengthCm,
      weight: gramsToKilograms(item.weightGrams),
      insurance_value: centsToCurrency(item.insuranceCents),
      quantity: item.quantity,
    })),
    options: {
      receipt: false,
      own_hand: false,
    },
  };
}

export function parseMelhorEnvioQuotes(
  value: unknown,
): readonly ShippingQuote[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): ShippingQuote[] => {
    if (!isRecord(item)) {
      return [];
    }

    const serviceId = readInteger(item.id);
    const price = readNumber(item.custom_price ?? item.price);
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const company = isRecord(item.company) ? item.company : null;
    const companyName =
      typeof company?.name === 'string' ? company.name.trim() : '';

    if (!serviceId || price === null || !name) {
      return [];
    }

    const deliveryRange = readNestedRange(item);

    return [
      {
        id: `melhor-envio-${serviceId}`,
        provider: 'melhor-envio',
        serviceId,
        serviceName: [companyName, name].filter(Boolean).join(' '),
        priceCents: Math.round(price * 100),
        deliveryMinDays: deliveryRange.min,
        deliveryMaxDays: deliveryRange.max,
        raw: item,
      },
    ];
  });
}

export async function quoteShipping({
  destinationCep,
  items,
  totalCents,
}: {
  readonly destinationCep: string;
  readonly items: readonly ShippingQuoteItem[];
  readonly totalCents: number;
}): Promise<readonly ShippingQuote[]> {
  const env = readShippingEnv();

  if (!env.melhorEnvioAccessToken || !env.melhorEnvioOriginCep) {
    return getFallbackShippingQuotes({ destinationCep, totalCents });
  }

  const response = await fetch(
    `${env.melhorEnvioBaseUrl.replace(/\/+$/, '')}/api/v2/me/shipment/calculate`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.melhorEnvioAccessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': env.melhorEnvioUserAgent,
      },
      body: JSON.stringify(
        buildMelhorEnvioQuotePayload({
          originCep: env.melhorEnvioOriginCep,
          destinationCep,
          items,
        }),
      ),
    },
  );

  if (!response.ok) {
    return getFallbackShippingQuotes({ destinationCep, totalCents });
  }

  const quotes = parseMelhorEnvioQuotes(
    await response.json().catch(() => null),
  );

  return quotes.length > 0
    ? quotes
    : getFallbackShippingQuotes({ destinationCep, totalCents });
}
