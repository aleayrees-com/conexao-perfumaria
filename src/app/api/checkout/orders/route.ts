import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/admin-data';
import { getSupabaseProductsStrict } from '@/lib/catalog';
import { buildWhatsAppUrl, type CheckoutQuoteItem } from '@/lib/checkout';
import {
  buildCheckoutCustomerRecord,
  mergeMarketingOptIn,
  normalizeCustomerPhone,
} from '@/lib/customer-profile';
import { publicEnv } from '@/lib/env';
import { createInfinitePayPaymentLink } from '@/lib/infinitepay';
import {
  checkRateLimit,
  hasAllowedOrigin,
  readClientIp,
} from '@/lib/request-guard';
import {
  normalizeCep,
  quoteShipping,
  type ShippingProvider,
  type ShippingQuote,
} from '@/lib/shipping';
import { productVariantToShippingQuoteItem } from '@/lib/shipping-products';
import {
  STORE_PICKUP_ADDRESS,
  STORE_PICKUP_SHIPPING_QUOTE,
} from '@/lib/store-pickup';
import {
  isTestProductVariantId,
  TEST_FREE_SHIPPING_QUOTE,
} from '@/lib/test-product';
import type { Product, ProductVariant } from '@/types/catalog';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

interface CheckoutRequestItem {
  readonly variantId: number;
  readonly quantity: number;
}

interface CheckoutCustomer {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly marketingOptIn: boolean;
}

interface CheckoutAddress {
  readonly cep: string;
  readonly street: string;
  readonly number: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly complement: string | null;
}

interface CheckoutShippingSelection {
  readonly id: string;
  readonly provider: ShippingProvider;
  readonly serviceId: number | null;
}

interface CheckoutDetails {
  readonly customer: CheckoutCustomer;
  readonly address: CheckoutAddress | null;
  readonly shippingSelection: CheckoutShippingSelection;
}

interface QuoteLine {
  readonly product: Product;
  readonly variant: ProductVariant;
  readonly quantity: number;
}

interface ExistingCustomerProfile {
  readonly id: string;
  readonly marketingOptIn: boolean;
  readonly metadata: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPositiveInteger(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const integer = Math.trunc(value);

  return integer > 0 ? Math.min(integer, max) : null;
}

function parseCheckoutItems(value: unknown): readonly CheckoutRequestItem[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return [];
  }

  const mergedItems = new Map<number, number>();

  for (const item of value.items.slice(0, MAX_ITEMS)) {
    if (!isRecord(item)) {
      continue;
    }

    const variantId = readPositiveInteger(
      item.variantId,
      Number.MAX_SAFE_INTEGER,
    );
    const quantity = readPositiveInteger(item.quantity, MAX_QUANTITY);

    if (!variantId || !quantity) {
      continue;
    }

    mergedItems.set(
      variantId,
      Math.min((mergedItems.get(variantId) ?? 0) + quantity, MAX_QUANTITY),
    );
  }

  return Array.from(mergedItems.entries()).map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

function readTrimmedString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = record[key];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue.slice(0, maxLength) : null;
}

function parseCustomer(value: unknown): CheckoutCustomer | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = readTrimmedString(value, 'name', 120);
  const email = readTrimmedString(value, 'email', 160);
  const phone = readTrimmedString(value, 'phone', 40);
  const normalizedPhone = phone ? normalizeCustomerPhone(phone) : '';
  const marketingOptIn = value.marketingOptIn === true;

  if (!name || !email || !phone || normalizedPhone.length < 8) {
    return null;
  }

  return { name, email, marketingOptIn, phone };
}

function parseAddress(value: unknown): CheckoutAddress | null {
  if (!isRecord(value)) {
    return null;
  }

  const cepValue = readTrimmedString(value, 'cep', 16);
  const cep = cepValue ? normalizeCep(cepValue) : '';
  const street = readTrimmedString(value, 'street', 160);
  const number = readTrimmedString(value, 'number', 32);
  const neighborhood = readTrimmedString(value, 'neighborhood', 120);
  const city = readTrimmedString(value, 'city', 120);
  const state = readTrimmedString(value, 'state', 2)?.toUpperCase() ?? null;
  const complement = readTrimmedString(value, 'complement', 120);

  if (
    cep.length !== 8 ||
    !street ||
    !number ||
    !neighborhood ||
    !city ||
    !state
  ) {
    return null;
  }

  return {
    cep,
    street,
    number,
    neighborhood,
    city,
    state,
    complement,
  };
}

function parseShippingSelection(
  value: unknown,
): CheckoutShippingSelection | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readTrimmedString(value, 'id', 80);
  const provider = readTrimmedString(value, 'provider', 40);
  const serviceId =
    typeof value.serviceId === 'number' && Number.isFinite(value.serviceId)
      ? Math.trunc(value.serviceId)
      : null;

  if (
    !id ||
    (provider !== 'manual' &&
      provider !== 'melhor-envio' &&
      provider !== 'pickup')
  ) {
    return null;
  }

  return {
    id,
    provider,
    serviceId,
  };
}

function parseCheckoutDetails(value: unknown): CheckoutDetails | null {
  if (!isRecord(value)) {
    return null;
  }

  const customer = parseCustomer(value.customer);
  const shippingSelection = parseShippingSelection(value.shippingOption);
  const address =
    shippingSelection?.provider === 'pickup'
      ? null
      : parseAddress(value.address);

  if (!customer || !shippingSelection) {
    return null;
  }

  if (shippingSelection.provider !== 'pickup' && !address) {
    return null;
  }

  return {
    customer,
    address,
    shippingSelection,
  };
}

async function readRequestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function quoteCartItems({
  products,
  requestItems,
}: {
  readonly products: readonly Product[];
  readonly requestItems: readonly CheckoutRequestItem[];
}): QuoteLine[] | NextResponse {
  const quoteLines: QuoteLine[] = [];

  for (const requestItem of requestItems) {
    const product = products.find((currentProduct) =>
      currentProduct.variants.some(
        (variant) => variant.id === requestItem.variantId,
      ),
    );
    const variant = product?.variants.find(
      (currentVariant) => currentVariant.id === requestItem.variantId,
    );

    if (!product || !variant) {
      return NextResponse.json(
        { error: 'Um ou mais itens não existem mais no catálogo.' },
        { status: 409 },
      );
    }

    if (!product.available || !variant.available) {
      return NextResponse.json(
        { error: 'Um ou mais itens não estão disponíveis.' },
        { status: 409 },
      );
    }

    if (requestItem.quantity > variant.stock) {
      return NextResponse.json(
        { error: 'Quantidade maior que o estoque disponível.' },
        { status: 409 },
      );
    }

    quoteLines.push({ product, quantity: requestItem.quantity, variant });
  }

  return quoteLines;
}

function toTrackingItems(quoteLines: readonly QuoteLine[]) {
  return quoteLines.map(({ product, quantity, variant }) => ({
    item_id: variant.sku ?? String(variant.id),
    item_name: product.name,
    item_variant: variant.label,
    item_category: product.category?.name,
    price: variant.priceCents / 100,
    quantity,
  }));
}

function buildPublicUrl(path: string): string {
  return `${publicEnv.siteUrl.replace(/\/+$/, '')}${path}`;
}

function findSelectedShippingQuote(
  quotes: readonly ShippingQuote[],
  selection: CheckoutShippingSelection,
): ShippingQuote | null {
  return (
    quotes.find(
      (quote) =>
        quote.id === selection.id &&
        quote.provider === selection.provider &&
        (selection.serviceId === null ||
          quote.serviceId === selection.serviceId),
    ) ?? null
  );
}

function formatPhoneForInfinitePay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }

  return digits.length >= 10 ? `+55${digits}` : digits;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

async function findExistingCustomerProfile({
  client,
  email,
  phone,
}: {
  readonly client: ReturnType<typeof createAdminClient>;
  readonly email: string;
  readonly phone: string;
}): Promise<ExistingCustomerProfile | null> {
  const byEmail = await client
    .from('customers')
    .select('id,marketing_opt_in,metadata')
    .ilike('email', email)
    .maybeSingle();

  if (byEmail.error) {
    throw new Error(byEmail.error.message);
  }

  if (byEmail.data) {
    return {
      id: byEmail.data.id,
      marketingOptIn: byEmail.data.marketing_opt_in,
      metadata: normalizeMetadata(byEmail.data.metadata),
    };
  }

  const byPhone = await client
    .from('customers')
    .select('id,marketing_opt_in,metadata')
    .eq('phone', phone)
    .maybeSingle();

  if (byPhone.error) {
    throw new Error(byPhone.error.message);
  }

  if (!byPhone.data) {
    return null;
  }

  return {
    id: byPhone.data.id,
    marketingOptIn: byPhone.data.marketing_opt_in,
    metadata: normalizeMetadata(byPhone.data.metadata),
  };
}

async function upsertCheckoutCustomerProfile({
  checkoutDetails,
  client,
  userAgent,
}: {
  readonly checkoutDetails: CheckoutDetails;
  readonly client: ReturnType<typeof createAdminClient>;
  readonly userAgent: string | null;
}): Promise<string | null> {
  const customerRecord = buildCheckoutCustomerRecord({
    address: { ...(checkoutDetails.address ?? STORE_PICKUP_ADDRESS) },
    customer: checkoutDetails.customer,
  });
  const checkedOutAt = new Date().toISOString();
  const existingCustomer = await findExistingCustomerProfile({
    client,
    email: customerRecord.email,
    phone: customerRecord.phone,
  });
  const metadata = {
    ...(existingCustomer?.metadata ?? {}),
    lastCheckout: {
      at: checkedOutAt,
      source: 'site-infinitepay',
      userAgent,
    },
  };

  if (existingCustomer) {
    const updateResponse = await client
      .from('customers')
      .update({
        ...customerRecord,
        marketing_opt_in: mergeMarketingOptIn(
          existingCustomer.marketingOptIn,
          customerRecord.marketing_opt_in,
        ),
        metadata,
      })
      .eq('id', existingCustomer.id);

    if (updateResponse.error) {
      throw new Error(updateResponse.error.message);
    }

    return existingCustomer.id;
  }

  const insertResponse = await client
    .from('customers')
    .insert({
      ...customerRecord,
      metadata,
    })
    .select('id')
    .single();

  if (insertResponse.error) {
    const refetchedCustomer = await findExistingCustomerProfile({
      client,
      email: customerRecord.email,
      phone: customerRecord.phone,
    });

    if (refetchedCustomer) {
      return refetchedCustomer.id;
    }

    throw new Error(insertResponse.error.message);
  }

  return insertResponse.data?.id ?? null;
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: 'Origem invalida.' }, { status: 403 });
  }

  const rateLimit = checkRateLimit({
    key: `checkout:${readClientIp(request.headers)}`,
    limit: 12,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em instantes.' },
      {
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
        status: 429,
      },
    );
  }

  const requestBody = await readRequestJson(request);
  const requestItems = parseCheckoutItems(requestBody);
  const checkoutDetails = parseCheckoutDetails(requestBody);

  if (requestItems.length === 0 || !checkoutDetails) {
    return NextResponse.json(
      { error: 'Carrinho ou dados de entrega inválidos.' },
      { status: 400 },
    );
  }

  try {
    const products = await getSupabaseProductsStrict();
    const quoted = quoteCartItems({ products, requestItems });

    if (quoted instanceof NextResponse) {
      return quoted;
    }

    const quoteItems: CheckoutQuoteItem[] = quoted.map(
      ({ product, quantity, variant }) => ({
        productName: product.name,
        variantLabel: variant.label,
        unitPriceCents: variant.priceCents,
        quantity,
      }),
    );
    const subtotalCents = quoted.reduce(
      (total, line) => total + line.variant.priceCents * line.quantity,
      0,
    );
    const isPickupCheckout =
      checkoutDetails.shippingSelection.provider === 'pickup';
    const shippingQuotes = isPickupCheckout
      ? [STORE_PICKUP_SHIPPING_QUOTE]
      : quoted.every((line) => isTestProductVariantId(line.variant.id))
        ? [TEST_FREE_SHIPPING_QUOTE]
        : await quoteShipping({
            destinationCep: checkoutDetails.address?.cep ?? '',
            totalCents: subtotalCents,
            items: quoted.map((line) =>
              productVariantToShippingQuoteItem(line),
            ),
          });
    const selectedShippingQuote = findSelectedShippingQuote(
      shippingQuotes,
      checkoutDetails.shippingSelection,
    );

    if (!selectedShippingQuote) {
      return NextResponse.json(
        { error: 'O frete escolhido não está mais disponível.' },
        { status: 409 },
      );
    }

    const totalCents = subtotalCents + selectedShippingQuote.priceCents;
    const client = createAdminClient();
    const eventId = crypto.randomUUID();
    const userAgent = request.headers.get('user-agent') ?? null;
    const customerId = await upsertCheckoutCustomerProfile({
      checkoutDetails,
      client,
      userAgent,
    });
    const baseOrderMetadata = {
      customer: {
        marketingOptIn: checkoutDetails.customer.marketingOptIn,
      },
      shipping: {
        selectedQuote: selectedShippingQuote,
      },
      trackingEventId: eventId,
      userAgent,
    };
    const orderResponse = await client
      .from('orders')
      .insert({
        customer_id: customerId,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'infinitepay',
        subtotal_cents: subtotalCents,
        shipping_cents: selectedShippingQuote.priceCents,
        total_cents: totalCents,
        customer_name: checkoutDetails.customer.name,
        customer_email: checkoutDetails.customer.email,
        customer_phone: checkoutDetails.customer.phone,
        shipping_address: {
          ...(checkoutDetails.address ?? STORE_PICKUP_ADDRESS),
        },
        source: 'site-infinitepay',
        placed_at: new Date().toISOString(),
        idempotency_key: eventId,
        metadata: baseOrderMetadata,
      })
      .select('id,order_number')
      .single();

    if (orderResponse.error || !orderResponse.data) {
      throw new Error(orderResponse.error?.message ?? 'Pedido não criado.');
    }

    const itemResponse = await client.from('order_items').insert(
      quoted.map(({ product, quantity, variant }) => ({
        order_id: orderResponse.data.id,
        product_id: null,
        variant_id: null,
        nuvemshop_product_id: product.id,
        nuvemshop_variant_id: variant.id,
        sku: variant.sku,
        product_name: product.name,
        variant_label: variant.label,
        image_url: variant.imageUrl ?? product.imageUrls[0] ?? null,
        unit_price_cents: variant.priceCents,
        quantity,
        metadata: {
          categoryName: product.category?.name ?? null,
          productSlug: product.slug,
        },
      })),
    );

    if (itemResponse.error) {
      await client.from('orders').delete().eq('id', orderResponse.data.id);
      throw new Error(itemResponse.error.message);
    }

    const infinitePayLink = await createInfinitePayPaymentLink({
      orderNsu: orderResponse.data.order_number,
      redirectUrl: buildPublicUrl('/api/payments/infinitepay/return'),
      webhookUrl: buildPublicUrl('/api/webhooks/infinitepay'),
      customer: {
        name: checkoutDetails.customer.name,
        email: checkoutDetails.customer.email,
        phoneNumber: formatPhoneForInfinitePay(checkoutDetails.customer.phone),
      },
      ...(checkoutDetails.address
        ? {
            address: {
              cep: checkoutDetails.address.cep,
              street: checkoutDetails.address.street,
              neighborhood: checkoutDetails.address.neighborhood,
              number: checkoutDetails.address.number,
              complement: checkoutDetails.address.complement ?? undefined,
            },
          }
        : {}),
      items: [
        ...quoted.map(({ product, quantity, variant }) => ({
          quantity,
          price: variant.priceCents,
          description: `${product.name} - ${variant.label}`,
        })),
        ...(selectedShippingQuote.priceCents > 0
          ? [
              {
                quantity: 1,
                price: selectedShippingQuote.priceCents,
                description: `Frete - ${selectedShippingQuote.serviceName}`,
              },
            ]
          : []),
      ],
    }).catch(async (error: unknown) => {
      await client
        .from('orders')
        .update({
          payment_status: 'failed',
          metadata: {
            ...baseOrderMetadata,
            infinitepay: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Erro desconhecido ao criar link.',
              failedAt: new Date().toISOString(),
            },
          },
        })
        .eq('id', orderResponse.data.id);

      throw error;
    });
    await client
      .from('orders')
      .update({
        metadata: {
          ...baseOrderMetadata,
          infinitepay: {
            checkoutUrl: infinitePayLink.checkoutUrl,
            linkPayload: infinitePayLink.payload,
            linkResponse: infinitePayLink.responseBody,
            createdAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', orderResponse.data.id);

    const trackingItems = toTrackingItems(quoted);
    const trackingValue = trackingItems.reduce(
      (total, item) => total + item.price * item.quantity,
      selectedShippingQuote.priceCents / 100,
    );

    return NextResponse.json({
      checkoutUrl: infinitePayLink.checkoutUrl,
      orderNumber: orderResponse.data.order_number,
      whatsappUrl: buildWhatsAppUrl(
        publicEnv.whatsappNumber,
        quoteItems,
        orderResponse.data.order_number,
      ),
      tracking: {
        eventId,
        currency: 'BRL',
        value: trackingValue,
        transactionId: orderResponse.data.order_number,
        items: trackingItems,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível criar o pedido agora.' },
      { status: 503 },
    );
  }
}
