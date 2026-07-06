import { NextResponse } from 'next/server';

import { getSupabaseProductsStrict } from '@/lib/catalog';
import {
  checkRateLimit,
  hasAllowedOrigin,
  readClientIp,
} from '@/lib/request-guard';
import { normalizeCep, quoteShipping } from '@/lib/shipping';
import { productVariantToShippingQuoteItem } from '@/lib/shipping-products';
import {
  isTestProductVariantId,
  TEST_FREE_SHIPPING_QUOTE,
} from '@/lib/test-product';
import type { Product, ProductVariant } from '@/types/catalog';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

interface QuoteRequestItem {
  readonly variantId: number;
  readonly quantity: number;
}

interface QuoteLine {
  readonly product: Product;
  readonly variant: ProductVariant;
  readonly quantity: number;
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

function parseItems(value: unknown): readonly QuoteRequestItem[] {
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

function parseDestinationCep(value: unknown): string | null {
  if (!isRecord(value) || typeof value.destinationCep !== 'string') {
    return null;
  }

  const cep = normalizeCep(value.destinationCep);

  return cep.length === 8 ? cep : null;
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
  readonly requestItems: readonly QuoteRequestItem[];
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

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request.headers)) {
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  }

  const rateLimit = checkRateLimit({
    key: `shipping:${readClientIp(request.headers)}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitas cotações em pouco tempo.' },
      {
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
        status: 429,
      },
    );
  }

  const body = await readRequestJson(request);
  const requestItems = parseItems(body);
  const destinationCep = parseDestinationCep(body);

  if (requestItems.length === 0 || !destinationCep) {
    return NextResponse.json(
      { error: 'Informe carrinho e CEP para calcular o frete.' },
      { status: 400 },
    );
  }

  const products = await getSupabaseProductsStrict();
  const quoted = quoteCartItems({ products, requestItems });

  if (quoted instanceof NextResponse) {
    return quoted;
  }

  const totalCents = quoted.reduce(
    (total, line) => total + line.variant.priceCents * line.quantity,
    0,
  );

  if (quoted.every((line) => isTestProductVariantId(line.variant.id))) {
    return NextResponse.json({ quotes: [TEST_FREE_SHIPPING_QUOTE] });
  }

  const quotes = await quoteShipping({
    destinationCep,
    totalCents,
    items: quoted.map((line) => productVariantToShippingQuoteItem(line)),
  });

  return NextResponse.json({ quotes });
}
