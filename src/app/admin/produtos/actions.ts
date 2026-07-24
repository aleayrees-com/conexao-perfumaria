'use server';

import { redirect } from 'next/navigation';

import {
  createAdminClient,
  insertAdminAuditLog,
  revalidateStorefrontCatalog,
} from '@/lib/admin-data';
import { requireAdmin } from '@/lib/admin-auth';
import { calculateCardPriceCents } from '@/lib/admin-pricing';
import { createCatalogSlug } from '@/lib/catalog-slug';

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readNullableString(formData: FormData, key: string): string | null {
  const value = readString(formData, key);

  return value ? value : null;
}

function parseMoneyCents(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseFloat(value.replace(',', '.'));

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? Math.round(parsedValue * 100)
    : null;
}

function readMoneyCents(formData: FormData, key: string): number {
  return parseMoneyCents(readString(formData, key)) ?? 0;
}

function readOptionalMoneyCents(
  formData: FormData,
  key: string,
): number | null {
  const rawValue = readString(formData, key).replace(',', '.');

  return parseMoneyCents(rawValue);
}

function readInteger(formData: FormData, key: string): number {
  const parsedValue = Number.parseInt(readString(formData, key), 10);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

function readPositiveInteger(
  formData: FormData,
  key: string,
  fallback: number,
): number {
  const parsedValue = Number.parseInt(readString(formData, key), 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function readStatus(value: string): 'draft' | 'active' | 'archived' {
  return value === 'active' || value === 'archived' ? value : 'draft';
}

function isMissingShippingColumnError(error: {
  readonly message: string;
}): boolean {
  return /shipping_(weight_grams|height_cm|width_cm|length_cm)/i.test(
    error.message,
  );
}

export async function updateProductQuickAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const productId = readString(formData, 'productId');
  const client = createAdminClient();
  const status = readStatus(readString(formData, 'status'));
  const pixPriceCents = readMoneyCents(formData, 'pixPrice');
  const response = await client
    .from('products')
    .update({
      price_cents: calculateCardPriceCents(pixPriceCents),
      pix_price_cents: pixPriceCents,
      status,
      is_available: status === 'active',
      published_at:
        status === 'active'
          ? (readNullableString(formData, 'publishedAt') ??
            new Date().toISOString())
          : null,
    })
    .eq('id', productId);

  if (response.error) {
    throw new Error(response.error.message);
  }

  revalidateStorefrontCatalog();
  redirect('/admin/produtos');
}

export async function updateProductDetailAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const productId = readString(formData, 'productId');
  const status = readStatus(readString(formData, 'status'));
  const client = createAdminClient();
  const pixPriceCents = readMoneyCents(formData, 'pixPrice');
  const productUpdate = {
    category_id: readNullableString(formData, 'categoryId'),
    name: readString(formData, 'name'),
    slug: readString(formData, 'slug'),
    description: readString(formData, 'description'),
    status,
    price_cents: calculateCardPriceCents(pixPriceCents),
    compare_at_price_cents: readOptionalMoneyCents(formData, 'compareAtPrice'),
    pix_price_cents: pixPriceCents,
    is_available: status === 'active',
    shipping_weight_grams: readPositiveInteger(
      formData,
      'shippingWeightGrams',
      250,
    ),
    shipping_height_cm: readPositiveInteger(formData, 'shippingHeightCm', 8),
    shipping_width_cm: readPositiveInteger(formData, 'shippingWidthCm', 8),
    shipping_length_cm: readPositiveInteger(formData, 'shippingLengthCm', 16),
    published_at:
      status === 'active'
        ? (readNullableString(formData, 'publishedAt') ??
          new Date().toISOString())
        : null,
  };
  const productResponse = await client
    .from('products')
    .update(productUpdate)
    .eq('id', productId);

  if (
    productResponse.error &&
    isMissingShippingColumnError(productResponse.error)
  ) {
    const fallbackResponse = await client
      .from('products')
      .update({
        category_id: productUpdate.category_id,
        name: productUpdate.name,
        slug: productUpdate.slug,
        description: productUpdate.description,
        status: productUpdate.status,
        price_cents: productUpdate.price_cents,
        compare_at_price_cents: productUpdate.compare_at_price_cents,
        pix_price_cents: productUpdate.pix_price_cents,
        is_available: productUpdate.is_available,
        published_at: productUpdate.published_at,
      })
      .eq('id', productId);

    if (fallbackResponse.error) {
      throw new Error(fallbackResponse.error.message);
    }
  } else if (productResponse.error) {
    throw new Error(productResponse.error.message);
  }

  const variantIds = formData.getAll('variantId').map(String);

  for (const variantId of variantIds) {
    const variantPixPriceCents = readMoneyCents(
      formData,
      `variantPixPrice:${variantId}`,
    );
    const variantResponse = await client
      .from('product_variants')
      .update({
        label: readString(formData, `variantLabel:${variantId}`),
        sku: readNullableString(formData, `variantSku:${variantId}`),
        price_cents: calculateCardPriceCents(variantPixPriceCents),
        pix_price_cents: variantPixPriceCents,
        stock: readInteger(formData, `variantStock:${variantId}`),
        is_available:
          readString(formData, `variantAvailable:${variantId}`) === 'on',
      })
      .eq('id', variantId);

    if (variantResponse.error) {
      throw new Error(variantResponse.error.message);
    }
  }

  await client.rpc('refresh_product_stock', { target_product_id: productId });
  revalidateStorefrontCatalog();
  redirect(`/admin/produtos/${productId}`);
}

export async function createProductAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = readString(formData, 'name');

  if (!name) {
    throw new Error('Nome do produto vazio; informe um nome para cadastrar.');
  }

  const status = readStatus(readString(formData, 'status'));
  const pixPriceCents = readMoneyCents(formData, 'pixPrice');
  const stock = readInteger(formData, 'stock');
  const client = createAdminClient();
  const productResponse = await client
    .from('products')
    .insert({
      category_id: readNullableString(formData, 'categoryId'),
      name,
      slug: readString(formData, 'slug') || createCatalogSlug(name),
      description: readString(formData, 'description'),
      status,
      price_cents: calculateCardPriceCents(pixPriceCents),
      pix_price_cents: pixPriceCents,
      compare_at_price_cents: readOptionalMoneyCents(
        formData,
        'compareAtPrice',
      ),
      total_stock: stock,
      is_available: status === 'active',
      published_at: status === 'active' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (productResponse.error) {
    throw new Error(
      `Falha ao cadastrar o produto "${name}": ${productResponse.error.message}`,
    );
  }

  const variantResponse = await client.from('product_variants').insert({
    product_id: productResponse.data.id,
    label: readString(formData, 'variantLabel') || 'Padrão',
    sku: readNullableString(formData, 'sku'),
    price_cents: calculateCardPriceCents(pixPriceCents),
    pix_price_cents: pixPriceCents,
    compare_at_price_cents: readOptionalMoneyCents(formData, 'compareAtPrice'),
    stock,
    is_available: status === 'active',
    sort_order: 0,
  });

  if (variantResponse.error) {
    throw new Error(
      `Falha ao cadastrar a variação de "${name}": ${variantResponse.error.message}`,
    );
  }

  await insertAdminAuditLog(client, {
    action: 'product_created',
    entityType: 'products',
    entityId: productResponse.data.id,
    metadata: { name, status },
  });
  revalidateStorefrontCatalog();
  redirect(`/admin/produtos/${productResponse.data.id}`);
}
