const DEFAULT_INFINITEPAY_HANDLE = 'conexaoperfumaria';
const DEFAULT_INFINITEPAY_LINKS_ENDPOINT =
  'https://api.checkout.infinitepay.io/links';
const DEFAULT_INFINITEPAY_PAYMENT_CHECK_ENDPOINT =
  'https://api.checkout.infinitepay.io/payment_check';

const CHECKOUT_URL_KEYS = [
  'url',
  'checkout_url',
  'checkoutUrl',
  'payment_url',
  'paymentUrl',
  'payment_link',
  'paymentLink',
  'link',
] as const;

interface InfinitePayEnv {
  readonly handle: string;
  readonly linksEndpoint: string;
  readonly paymentCheckEndpoint: string;
}

export interface InfinitePayLinkItem {
  readonly quantity: number;
  readonly price: number;
  readonly description: string;
}

export interface InfinitePayLinkInput {
  readonly orderNsu: string;
  readonly items: readonly InfinitePayLinkItem[];
  readonly redirectUrl: string;
  readonly webhookUrl: string;
  readonly customer?: {
    readonly name: string;
    readonly email: string;
    readonly phoneNumber: string;
  };
  readonly address?: {
    readonly cep: string;
    readonly street: string;
    readonly neighborhood: string;
    readonly number: string;
    readonly complement?: string;
  };
}

interface InfinitePayLinkPayload {
  readonly handle: string;
  readonly items: readonly InfinitePayLinkItem[];
  readonly order_nsu: string;
  readonly redirect_url: string;
  readonly webhook_url: string;
  readonly customer?: {
    readonly name: string;
    readonly email: string;
    readonly phone_number: string;
  };
  readonly address?: {
    readonly cep: string;
    readonly street: string;
    readonly neighborhood: string;
    readonly number: string;
    readonly complement?: string;
  };
}

export interface InfinitePayPaymentCheckInput {
  readonly orderNsu: string;
  readonly transactionNsu: string;
  readonly slug: string;
}

export interface InfinitePayPaymentCheckResult {
  readonly success: boolean;
  readonly paid: boolean;
  readonly amount: number | null;
  readonly paidAmount: number | null;
  readonly installments: number | null;
  readonly captureMethod: string | null;
  readonly responseBody: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readInfinitePayEnv(): InfinitePayEnv {
  return {
    handle:
      process.env.INFINITEPAY_HANDLE?.trim() || DEFAULT_INFINITEPAY_HANDLE,
    linksEndpoint:
      process.env.INFINITEPAY_LINKS_ENDPOINT?.trim() ||
      DEFAULT_INFINITEPAY_LINKS_ENDPOINT,
    paymentCheckEndpoint:
      process.env.INFINITEPAY_PAYMENT_CHECK_ENDPOINT?.trim() ||
      DEFAULT_INFINITEPAY_PAYMENT_CHECK_ENDPOINT,
  };
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

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildInfinitePayLinkPayload(
  input: InfinitePayLinkInput,
): InfinitePayLinkPayload {
  const env = readInfinitePayEnv();
  const basePayload = {
    handle: env.handle,
    items: input.items,
    order_nsu: input.orderNsu,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
  };

  return {
    ...basePayload,
    ...(input.customer
      ? {
          customer: {
            name: input.customer.name,
            email: input.customer.email,
            phone_number: input.customer.phoneNumber,
          },
        }
      : {}),
    ...(input.address ? { address: input.address } : {}),
  };
}

export function extractInfinitePayCheckoutUrl(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of CHECKOUT_URL_KEYS) {
    const candidate = readString(value[key]);

    if (candidate && isAbsoluteHttpUrl(candidate)) {
      return candidate;
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (isRecord(nestedValue)) {
      const nestedUrl = extractInfinitePayCheckoutUrl(nestedValue);

      if (nestedUrl) {
        return nestedUrl;
      }
    }
  }

  return null;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null) as Promise<unknown>;
}

export async function createInfinitePayPaymentLink(
  input: InfinitePayLinkInput,
): Promise<{
  readonly checkoutUrl: string;
  readonly payload: InfinitePayLinkPayload;
  readonly responseBody: unknown;
}> {
  const env = readInfinitePayEnv();
  const payload = buildInfinitePayLinkPayload(input);
  const response = await fetch(env.linksEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(`InfinitePay link falhou com status ${response.status}.`);
  }

  const checkoutUrl = extractInfinitePayCheckoutUrl(responseBody);

  if (!checkoutUrl) {
    throw new Error('InfinitePay não retornou URL de checkout.');
  }

  return { checkoutUrl, payload, responseBody };
}

export async function checkInfinitePayPayment(
  input: InfinitePayPaymentCheckInput,
): Promise<InfinitePayPaymentCheckResult> {
  const env = readInfinitePayEnv();
  const response = await fetch(env.paymentCheckEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      handle: env.handle,
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.slug,
    }),
  });
  const responseBody = await readJsonResponse(response);

  if (!response.ok || !isRecord(responseBody)) {
    throw new Error(
      `InfinitePay payment_check falhou com status ${response.status}.`,
    );
  }

  return {
    success: readBoolean(responseBody.success),
    paid: readBoolean(responseBody.paid),
    amount: readNumber(responseBody.amount),
    paidAmount: readNumber(responseBody.paid_amount),
    installments: readNumber(responseBody.installments),
    captureMethod: readString(responseBody.capture_method),
    responseBody,
  };
}
