'use server';

import { redirect } from 'next/navigation';

import {
  applyMoneyOperation,
  parseBulkProductsCsv,
  type BulkMoneyMode,
  type ProductStatus,
} from '@/lib/admin-product-bulk';
import { requireAdmin } from '@/lib/admin-auth';
import {
  createAdminClient,
  insertAdminAuditLog,
  revalidateStorefrontCatalog,
} from '@/lib/admin-data';
import { calculateCardPriceCents } from '@/lib/admin-pricing';

type ProductMoneyField = 'pix_price_cents' | 'compare_at_price_cents';
type MoneyValueSource = {
  readonly compare_at_price_cents: number | string | null;
  readonly pix_price_cents: number | string | null;
  readonly price_cents: number | string;
};

const MAX_BULK_PRODUCTS = 750;

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function parseProductIds(formData: FormData): readonly string[] {
  const ids = readString(formData, 'productIds')
    .split('|')
    .map((id) => id.trim())
    .filter(Boolean);

  return Array.from(new Set(ids)).slice(0, MAX_BULK_PRODUCTS);
}

function readStatus(value: string): ProductStatus {
  if (value === 'active' || value === 'archived') {
    return value;
  }

  return 'draft';
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

function readMoneyOperation(formData: FormData): {
  readonly mode: BulkMoneyMode;
  readonly value: number | null;
} {
  const mode = readString(formData, 'moneyMode') as BulkMoneyMode;
  const percentModes: readonly BulkMoneyMode[] = [
    'increase_percent',
    'decrease_percent',
  ];

  if (mode === 'clear') {
    return { mode, value: null };
  }

  if (percentModes.includes(mode)) {
    const parsedValue = Number.parseFloat(
      readString(formData, 'moneyValue').replace(',', '.'),
    );

    return {
      mode,
      value: Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0,
    };
  }

  return {
    mode:
      mode === 'set' || mode === 'increase_amount' ? mode : 'decrease_amount',
    value: parseMoneyCents(readString(formData, 'moneyValue')) ?? 0,
  };
}

function readMoneyField(value: string): ProductMoneyField {
  if (value === 'compare') {
    return 'compare_at_price_cents';
  }

  return 'pix_price_cents';
}

function toMoneyCents(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' ? value : Number.parseInt(value, 10);
}

function readCurrentMoneyValue(
  source: MoneyValueSource,
  field: ProductMoneyField,
): number | null {
  if (field === 'pix_price_cents') {
    return (
      toMoneyCents(source.pix_price_cents) ?? toMoneyCents(source.price_cents)
    );
  }

  return toMoneyCents(source.compare_at_price_cents);
}

function createMoneyUpdate(
  field: ProductMoneyField,
  value: number | null,
): Record<string, number | null> {
  if (field === 'pix_price_cents') {
    const pixPriceCents = value ?? 0;

    return {
      pix_price_cents: pixPriceCents,
      price_cents: calculateCardPriceCents(pixPriceCents),
    };
  }

  return { compare_at_price_cents: value };
}

function readStockMode(value: string): 'set' | 'increase' | 'decrease' {
  if (value === 'increase' || value === 'decrease') {
    return value;
  }

  return 'set';
}

function parseInteger(value: string): number | null {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function applyStockOperation(
  currentStock: number,
  mode: 'set' | 'increase' | 'decrease',
  value: number,
): number {
  if (mode === 'set') {
    return value;
  }

  if (mode === 'increase') {
    return currentStock + value;
  }

  return Math.max(0, currentStock - value);
}

function parseBooleanValue(value: string): boolean | null {
  const normalizedValue = value.trim().toLowerCase();

  if (
    ['sim', 'true', '1', 'yes', 'ativo', 'disponivel'].includes(normalizedValue)
  ) {
    return true;
  }

  if (
    ['nao', 'não', 'false', '0', 'no', 'inativo', 'indisponivel'].includes(
      normalizedValue,
    )
  ) {
    return false;
  }

  return null;
}

async function refreshTouchedProducts(
  productIds: readonly string[],
): Promise<void> {
  const client = createAdminClient();

  for (const productId of productIds) {
    const response = await client.rpc('refresh_product_stock', {
      target_product_id: productId,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }
  }
}

export async function applyBulkProductAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  if (readString(formData, 'confirmText') !== 'APLICAR') {
    throw new Error('Digite APLICAR para confirmar a edição em escala.');
  }

  const productIds = parseProductIds(formData);

  if (productIds.length === 0) {
    throw new Error('Selecione pelo menos um produto.');
  }

  const client = createAdminClient();
  const operation = readString(formData, 'operation');

  if (operation === 'set_status') {
    const status = readStatus(readString(formData, 'status'));
    const response = await client
      .from('products')
      .update({
        status,
        published_at: status === 'active' ? new Date().toISOString() : null,
      })
      .in('id', productIds);

    if (response.error) {
      throw new Error(response.error.message);
    }
  }

  if (operation === 'set_category') {
    const categoryId = readString(formData, 'categoryId') || null;
    const response = await client
      .from('products')
      .update({ category_id: categoryId })
      .in('id', productIds);

    if (response.error) {
      throw new Error(response.error.message);
    }
  }

  if (operation === 'adjust_price') {
    const field = readMoneyField(readString(formData, 'moneyField'));
    const moneyOperation = readMoneyOperation(formData);

    if (field === 'pix_price_cents' && moneyOperation.mode === 'clear') {
      throw new Error(
        'O preço PIX é obrigatório; escolha um valor igual ou maior que zero.',
      );
    }

    const [productsResponse, variantsResponse] = await Promise.all([
      client
        .from('products')
        .select('id,price_cents,pix_price_cents,compare_at_price_cents')
        .in('id', productIds),
      client
        .from('product_variants')
        .select('id,price_cents,pix_price_cents,compare_at_price_cents')
        .in('product_id', productIds),
    ]);

    if (productsResponse.error) {
      throw new Error(productsResponse.error.message);
    }

    if (variantsResponse.error) {
      throw new Error(variantsResponse.error.message);
    }

    for (const product of productsResponse.data ?? []) {
      const value = applyMoneyOperation(
        readCurrentMoneyValue(product, field),
        moneyOperation,
      );
      const response = await client
        .from('products')
        .update(createMoneyUpdate(field, value))
        .eq('id', product.id);

      if (response.error) {
        throw new Error(response.error.message);
      }
    }

    for (const variant of variantsResponse.data ?? []) {
      const value = applyMoneyOperation(
        readCurrentMoneyValue(variant, field),
        moneyOperation,
      );
      const response = await client
        .from('product_variants')
        .update(createMoneyUpdate(field, value))
        .eq('id', variant.id);

      if (response.error) {
        throw new Error(response.error.message);
      }
    }
  }

  if (operation === 'adjust_stock') {
    const mode = readStockMode(readString(formData, 'stockMode'));
    const value = parseInteger(readString(formData, 'stockValue')) ?? 0;
    const variantsResponse = await client
      .from('product_variants')
      .select('id,stock')
      .in('product_id', productIds);

    if (variantsResponse.error) {
      throw new Error(variantsResponse.error.message);
    }

    for (const variant of variantsResponse.data ?? []) {
      const currentStock =
        typeof variant.stock === 'number'
          ? variant.stock
          : Number.parseInt(String(variant.stock), 10);
      const response = await client
        .from('product_variants')
        .update({ stock: applyStockOperation(currentStock, mode, value) })
        .eq('id', variant.id);

      if (response.error) {
        throw new Error(response.error.message);
      }
    }

    await refreshTouchedProducts(productIds);
  }

  if (operation === 'set_availability') {
    const available = readString(formData, 'availability') === 'available';
    const response = await client
      .from('product_variants')
      .update({ is_available: available })
      .in('product_id', productIds);

    if (response.error) {
      throw new Error(response.error.message);
    }

    await refreshTouchedProducts(productIds);
  }

  await insertAdminAuditLog(client, {
    action: 'bulk_product_update',
    entityType: 'products',
    metadata: {
      operation,
      productCount: productIds.length,
      productIds,
    },
  });

  revalidateStorefrontCatalog();
  redirect(`/admin/produtos/edicao-em-massa?updated=${productIds.length}`);
}

export async function importProductCsvAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  if (readString(formData, 'confirmImportText') !== 'IMPORTAR') {
    throw new Error('Digite IMPORTAR para confirmar a importação CSV.');
  }

  const csvFile = formData.get('csvFile');

  if (!(csvFile instanceof File) || csvFile.size === 0) {
    throw new Error('Envie um arquivo CSV valido.');
  }

  const parsedCsv = parseBulkProductsCsv(await csvFile.text());

  if (parsedCsv.errors.length > 0) {
    throw new Error(parsedCsv.errors.join(' '));
  }

  const client = createAdminClient();
  const touchedProductIds = new Set<string>();
  let productUpdateCount = 0;
  let variantUpdateCount = 0;

  for (const row of parsedCsv.rows) {
    if (!row.productId) {
      continue;
    }

    touchedProductIds.add(row.productId);

    const productUpdate: Record<string, string | number | null> = {
      category_id: row.categoryId || null,
    };

    if (row.name) {
      productUpdate.name = row.name;
    }

    if (row.slug) {
      productUpdate.slug = row.slug;
    }

    if (row.status) {
      productUpdate.status = readStatus(row.status);
      productUpdate.published_at =
        row.status === 'active' ? new Date().toISOString() : null;
    }

    const productPixPrice = parseMoneyCents(row.pixPrice);
    const productCompareAtPrice = parseMoneyCents(row.compareAtPrice);
    const productPixPriceCents = productPixPrice ?? parseMoneyCents(row.price);

    if (productPixPriceCents !== null) {
      productUpdate.pix_price_cents = productPixPriceCents;
      productUpdate.price_cents = calculateCardPriceCents(productPixPriceCents);
    }

    productUpdate.compare_at_price_cents = productCompareAtPrice;

    const productResponse = await client
      .from('products')
      .update(productUpdate)
      .eq('id', row.productId);

    if (productResponse.error) {
      throw new Error(productResponse.error.message);
    }

    productUpdateCount += 1;

    if (!row.variantId) {
      continue;
    }

    const variantUpdate: Record<string, string | number | boolean | null> = {};

    if (row.variantLabel) {
      variantUpdate.label = row.variantLabel;
    }

    variantUpdate.sku = row.variantSku || null;

    const variantPixPrice = parseMoneyCents(row.variantPixPrice);
    const variantCompareAtPrice = parseMoneyCents(row.variantCompareAtPrice);
    const variantPixPriceCents =
      variantPixPrice ?? parseMoneyCents(row.variantPrice);
    const variantStock = parseInteger(row.variantStock);
    const variantAvailable = parseBooleanValue(row.variantAvailable);

    if (variantPixPriceCents !== null) {
      variantUpdate.pix_price_cents = variantPixPriceCents;
      variantUpdate.price_cents = calculateCardPriceCents(variantPixPriceCents);
    }

    variantUpdate.compare_at_price_cents = variantCompareAtPrice;

    if (variantStock !== null) {
      variantUpdate.stock = variantStock;
    }

    if (variantAvailable !== null) {
      variantUpdate.is_available = variantAvailable;
    }

    const variantResponse = await client
      .from('product_variants')
      .update(variantUpdate)
      .eq('id', row.variantId);

    if (variantResponse.error) {
      throw new Error(variantResponse.error.message);
    }

    variantUpdateCount += 1;
  }

  await refreshTouchedProducts(Array.from(touchedProductIds));
  await insertAdminAuditLog(client, {
    action: 'bulk_product_csv_import',
    entityType: 'products',
    metadata: {
      productCount: touchedProductIds.size,
      productUpdateCount,
      variantUpdateCount,
    },
  });

  revalidateStorefrontCatalog();
  redirect(
    `/admin/produtos/edicao-em-massa?imported=${touchedProductIds.size}`,
  );
}
