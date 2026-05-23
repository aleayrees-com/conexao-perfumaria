import { NextResponse } from 'next/server';

import { buildWhatsAppUrl, type CheckoutQuoteItem } from '@/lib/checkout';
import { getSupabaseProductsStrict } from '@/lib/catalog';
import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

interface CheckoutRequestItem {
  readonly variantId: number;
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

async function readRequestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const requestItems = parseCheckoutItems(await readRequestJson(request));

  if (requestItems.length === 0) {
    return NextResponse.json(
      { error: 'Carrinho vazio ou invalido.' },
      { status: 400 },
    );
  }

  try {
    const products = await getSupabaseProductsStrict();
    const quoteItems = requestItems.flatMap(
      (requestItem): CheckoutQuoteItem[] => {
        const product = products.find((currentProduct) =>
          currentProduct.variants.some(
            (variant) => variant.id === requestItem.variantId,
          ),
        );
        const variant = product?.variants.find(
          (currentVariant) => currentVariant.id === requestItem.variantId,
        );

        if (!product || !variant) {
          return [];
        }

        return [
          {
            productName: product.name,
            variantLabel: variant.label,
            unitPriceCents: variant.priceCents,
            quantity: requestItem.quantity,
          },
        ];
      },
    );

    if (quoteItems.length !== requestItems.length) {
      return NextResponse.json(
        { error: 'Um ou mais itens nao existem mais no catalogo.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      whatsappUrl: buildWhatsAppUrl(publicEnv.whatsappNumber, quoteItems),
    });
  } catch {
    return NextResponse.json(
      { error: 'Nao foi possivel recalcular o pedido pelo Supabase.' },
      { status: 503 },
    );
  }
}
