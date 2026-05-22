import { readFile } from 'node:fs/promises';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type {
  Product,
  ProductCategory,
  ProductVariant,
} from '../src/types/catalog.js';

const CATALOG_FILE = new URL('../src/data/products.json', import.meta.url);
const BATCH_SIZE = 50;
const isDryRun = process.argv.includes('--dry-run');

type DbId = number | string;
type JsonRecord = Record<string, unknown>;
type ProductStatus = 'draft' | 'active' | 'archived';

interface SupabaseOperationError {
  readonly message: string;
  readonly details?: string | null;
  readonly hint?: string | null;
  readonly code?: string | null;
}

interface CategoryRow extends Record<string, unknown> {
  readonly id: DbId;
  readonly slug: string;
  readonly name: string;
  readonly source_url: string | null;
}

interface CategoryInsert extends Record<string, unknown> {
  readonly slug: string;
  readonly name: string;
  readonly source_url: string | null;
}

interface ProductRow extends Record<string, unknown> {
  readonly id: DbId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly source_url: string;
  readonly category_id: DbId | null;
  readonly nuvemshop_product_id: number;
  readonly status: ProductStatus;
  readonly is_available: boolean;
  readonly price_cents: number;
  readonly compare_at_price_cents: number | null;
  readonly pix_price_cents: number | null;
  readonly total_stock: number;
  readonly imported_at: string;
  readonly published_at: string;
}

interface ProductInsert extends Record<string, unknown> {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly source_url: string;
  readonly category_id: DbId | null;
  readonly nuvemshop_product_id: number;
  readonly status: ProductStatus;
  readonly is_available: boolean;
  readonly price_cents: number;
  readonly compare_at_price_cents: number | null;
  readonly pix_price_cents: number | null;
  readonly total_stock: number;
  readonly imported_at: string;
  readonly published_at: string;
}

interface ProductVariantRow extends Record<string, unknown> {
  readonly id: DbId;
  readonly nuvemshop_variant_id: number;
  readonly product_id: DbId;
  readonly sku: string | null;
  readonly label: string;
  readonly price_cents: number;
  readonly compare_at_price_cents: number | null;
  readonly pix_price_cents: number | null;
  readonly stock: number;
  readonly is_available: boolean;
  readonly image_url: string | null;
}

interface ProductVariantInsert extends Record<string, unknown> {
  readonly nuvemshop_variant_id: number;
  readonly product_id: DbId;
  readonly sku: string | null;
  readonly label: string;
  readonly price_cents: number;
  readonly compare_at_price_cents: number | null;
  readonly pix_price_cents: number | null;
  readonly stock: number;
  readonly is_available: boolean;
  readonly image_url: string | null;
}

interface ProductImageRow extends Record<string, unknown> {
  readonly id: DbId;
  readonly product_id: DbId;
  readonly url: string;
  readonly sort_order: number;
  readonly alt_text: string | null;
  readonly is_primary: boolean;
}

interface ProductImageInsert extends Record<string, unknown> {
  readonly product_id: DbId;
  readonly url: string;
  readonly sort_order: number;
  readonly alt_text: string | null;
  readonly is_primary: boolean;
}

interface DatabaseTable<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown>,
  Update extends Record<string, unknown>,
> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

interface Database {
  public: {
    Tables: {
      categories: DatabaseTable<
        CategoryRow,
        CategoryInsert,
        Partial<CategoryInsert>
      >;
      products: DatabaseTable<
        ProductRow,
        ProductInsert,
        Partial<ProductInsert>
      >;
      product_variants: DatabaseTable<
        ProductVariantRow,
        ProductVariantInsert,
        Partial<ProductVariantInsert>
      >;
      product_images: DatabaseTable<
        ProductImageRow,
        ProductImageInsert,
        Partial<ProductImageInsert>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type CatalogSupabaseClient = SupabaseClient<Database>;

function asRecord(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} deve ser um objeto.`);
  }

  return value as JsonRecord;
}

function getRequiredString(
  record: JsonRecord,
  key: string,
  path: string,
): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path}.${key} deve ser uma string nao vazia.`);
  }

  return value;
}

function getNullableString(
  record: JsonRecord,
  key: string,
  path: string,
): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${path}.${key} deve ser string ou null.`);
  }

  return value;
}

function getRequiredNumber(
  record: JsonRecord,
  key: string,
  path: string,
): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} deve ser um numero finito.`);
  }

  return value;
}

function getNullableNumber(
  record: JsonRecord,
  key: string,
  path: string,
): number | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} deve ser numero ou null.`);
  }

  return value;
}

function getRequiredBoolean(
  record: JsonRecord,
  key: string,
  path: string,
): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new Error(`${path}.${key} deve ser boolean.`);
  }

  return value;
}

function parseCategory(value: unknown, path: string): ProductCategory | null {
  if (value === null || value === undefined) {
    return null;
  }

  const record = asRecord(value, path);

  return {
    name: getRequiredString(record, 'name', path),
    slug: getRequiredString(record, 'slug', path),
    url: getRequiredString(record, 'url', path),
  };
}

function parseVariant(value: unknown, path: string): ProductVariant {
  const record = asRecord(value, path);

  return {
    id: getRequiredNumber(record, 'id', path),
    sku: getNullableString(record, 'sku', path),
    label: getRequiredString(record, 'label', path),
    priceCents: getRequiredNumber(record, 'priceCents', path),
    compareAtPriceCents: getNullableNumber(record, 'compareAtPriceCents', path),
    pixPriceCents: getNullableNumber(record, 'pixPriceCents', path),
    stock: getRequiredNumber(record, 'stock', path),
    available: getRequiredBoolean(record, 'available', path),
    imageUrl: getNullableString(record, 'imageUrl', path),
  };
}

function parseStringArray(
  record: JsonRecord,
  key: string,
  path: string,
): readonly string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${path}.${key} deve ser um array.`);
  }

  return value.map((item, index) => {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`${path}.${key}[${index}] deve ser string nao vazia.`);
    }

    return item;
  });
}

function parseVariants(
  record: JsonRecord,
  key: string,
  path: string,
): readonly ProductVariant[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${path}.${key} deve ser um array.`);
  }

  return value.map((item, index) =>
    parseVariant(item, `${path}.${key}[${index}]`),
  );
}

function parseProduct(value: unknown, index: number): Product {
  const path = `products[${index}]`;
  const record = asRecord(value, path);

  return {
    id: getRequiredNumber(record, 'id', path),
    slug: getRequiredString(record, 'slug', path),
    name: getRequiredString(record, 'name', path),
    description: getRequiredString(record, 'description', path),
    sourceUrl: getRequiredString(record, 'sourceUrl', path),
    imageUrls: parseStringArray(record, 'imageUrls', path),
    category: parseCategory(record.category, `${path}.category`),
    variants: parseVariants(record, 'variants', path),
    priceCents: getRequiredNumber(record, 'priceCents', path),
    compareAtPriceCents: getNullableNumber(record, 'compareAtPriceCents', path),
    pixPriceCents: getNullableNumber(record, 'pixPriceCents', path),
    totalStock: getRequiredNumber(record, 'totalStock', path),
    available: getRequiredBoolean(record, 'available', path),
    importedAt: getRequiredString(record, 'importedAt', path),
  };
}

function parseCatalog(input: string): readonly Product[] {
  const parsed = JSON.parse(input) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('products.json deve conter um array de produtos.');
  }

  return parsed.map((item, index) => parseProduct(item, index));
}

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}.`);
  }

  return value;
}

function assertAllowedSupabaseProject(supabaseUrl: string): void {
  const blockedProjectRef = (process.env.BLOCKED_SUPABASE_PROJECT_REFS ?? '')
    .split(',')
    .map((projectRef) => projectRef.trim())
    .filter(Boolean)
    .find((projectRef) => supabaseUrl.includes(projectRef));

  if (blockedProjectRef) {
    throw new Error(
      `Importacao bloqueada: ${blockedProjectRef} e o Supabase do AlfraOS, nao da Conexao Perfumaria.`,
    );
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Erro desconhecido.';
}

function throwSupabaseError(
  context: string,
  error: SupabaseOperationError,
): never {
  const metadata = [error.code, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(' | ');

  throw new Error(
    `${context}: ${error.message}${metadata ? ` (${metadata})` : ''}`,
  );
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function getProductStatus(product: Product): ProductStatus {
  return product.sourceUrl ? 'active' : 'draft';
}

function countVariants(products: readonly Product[]): number {
  return products.reduce(
    (total, product) => total + product.variants.length,
    0,
  );
}

function countImages(products: readonly Product[]): number {
  return products.reduce(
    (total, product) => total + product.imageUrls.length,
    0,
  );
}

function buildCategoryRows(products: readonly Product[]): CategoryInsert[] {
  const rowsBySlug = new Map<string, CategoryInsert>();

  for (const product of products) {
    if (!product.category || rowsBySlug.has(product.category.slug)) {
      continue;
    }

    rowsBySlug.set(product.category.slug, {
      slug: product.category.slug,
      name: product.category.name,
      source_url: product.category.url,
    });
  }

  return [...rowsBySlug.values()];
}

function getCategoryId(
  categoryIds: ReadonlyMap<string, DbId>,
  product: Product,
): DbId | null {
  if (!product.category) {
    return null;
  }

  const categoryId = categoryIds.get(product.category.slug);

  if (categoryId === undefined) {
    throw new Error(`Categoria nao sincronizada: ${product.category.slug}.`);
  }

  return categoryId;
}

function buildProductRows(
  products: readonly Product[],
  categoryIds: ReadonlyMap<string, DbId>,
): ProductInsert[] {
  return products.map((product) => ({
    slug: product.slug,
    name: product.name,
    description: product.description,
    source_url: product.sourceUrl,
    category_id: getCategoryId(categoryIds, product),
    nuvemshop_product_id: product.id,
    status: getProductStatus(product),
    is_available: product.available,
    price_cents: product.priceCents,
    compare_at_price_cents: product.compareAtPriceCents,
    pix_price_cents: product.pixPriceCents,
    total_stock: product.totalStock,
    imported_at: product.importedAt,
    published_at: product.importedAt,
  }));
}

function getProductId(
  productIds: ReadonlyMap<number, DbId>,
  product: Product,
): DbId {
  const productId = productIds.get(product.id);

  if (productId === undefined) {
    throw new Error(`Produto nao sincronizado: ${product.slug}.`);
  }

  return productId;
}

function buildVariantRows(
  products: readonly Product[],
  productIds: ReadonlyMap<number, DbId>,
): ProductVariantInsert[] {
  const rowsByVariantId = new Map<number, ProductVariantInsert>();

  for (const product of products) {
    const productId = getProductId(productIds, product);

    for (const variant of product.variants) {
      rowsByVariantId.set(variant.id, {
        nuvemshop_variant_id: variant.id,
        product_id: productId,
        sku: variant.sku,
        label: variant.label,
        price_cents: variant.priceCents,
        compare_at_price_cents: variant.compareAtPriceCents,
        pix_price_cents: variant.pixPriceCents,
        stock: variant.stock,
        is_available: variant.available,
        image_url: variant.imageUrl,
      });
    }
  }

  return [...rowsByVariantId.values()];
}

function buildImageRows(
  products: readonly Product[],
  productIds: ReadonlyMap<number, DbId>,
): ProductImageInsert[] {
  const rowsByProductUrl = new Map<string, ProductImageInsert>();

  for (const product of products) {
    const productId = getProductId(productIds, product);

    product.imageUrls.forEach((url, index) => {
      const key = `${String(productId)}:${url}`;

      if (rowsByProductUrl.has(key)) {
        return;
      }

      rowsByProductUrl.set(key, {
        product_id: productId,
        url,
        sort_order: index + 1,
        alt_text: product.name,
        is_primary: index === 0,
      });
    });
  }

  return [...rowsByProductUrl.values()];
}

async function upsertCategories(
  client: CatalogSupabaseClient,
  rows: readonly CategoryInsert[],
): Promise<ReadonlyMap<string, DbId>> {
  const idsBySlug = new Map<string, DbId>();

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { data, error } = await client
      .from('categories')
      .upsert(batch, { onConflict: 'slug' })
      .select('id, slug');

    if (error) {
      throwSupabaseError('Falha ao sincronizar categorias', error);
    }

    for (const row of data ?? []) {
      idsBySlug.set(row.slug, row.id);
    }
  }

  return idsBySlug;
}

async function upsertProducts(
  client: CatalogSupabaseClient,
  rows: readonly ProductInsert[],
): Promise<ReadonlyMap<number, DbId>> {
  const idsByNuvemshopId = new Map<number, DbId>();

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { data, error } = await client
      .from('products')
      .upsert(batch, { onConflict: 'nuvemshop_product_id' })
      .select('id, nuvemshop_product_id');

    if (error) {
      throwSupabaseError('Falha ao sincronizar produtos', error);
    }

    for (const row of data ?? []) {
      idsByNuvemshopId.set(row.nuvemshop_product_id, row.id);
    }
  }

  return idsByNuvemshopId;
}

async function upsertVariants(
  client: CatalogSupabaseClient,
  rows: readonly ProductVariantInsert[],
): Promise<void> {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await client
      .from('product_variants')
      .upsert(batch, { onConflict: 'nuvemshop_variant_id' });

    if (error) {
      throwSupabaseError('Falha ao sincronizar variacoes', error);
    }
  }
}

async function upsertImages(
  client: CatalogSupabaseClient,
  rows: readonly ProductImageInsert[],
): Promise<void> {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await client
      .from('product_images')
      .upsert(batch, { onConflict: 'product_id,url' });

    if (error) {
      throwSupabaseError('Falha ao sincronizar imagens', error);
    }
  }
}

async function readCatalog(): Promise<readonly Product[]> {
  const rawCatalog = await readFile(CATALOG_FILE, 'utf8');

  return parseCatalog(rawCatalog);
}

async function importProductsToSupabase(): Promise<void> {
  const products = await readCatalog();

  if (isDryRun) {
    console.log(`Dry-run OK: ${products.length} produtos.`);
    console.log(`Categorias: ${buildCategoryRows(products).length}.`);
    console.log(`Variacoes: ${countVariants(products)}.`);
    console.log(`Imagens: ${countImages(products)}.`);
    return;
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  assertAllowedSupabaseProject(supabaseUrl);

  const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log(`Catalogo carregado: ${products.length} produtos.`);

  const categoryRows = buildCategoryRows(products);
  const categoryIds = await upsertCategories(client, categoryRows);
  console.log(`Categorias sincronizadas: ${categoryIds.size}.`);

  const productRows = buildProductRows(products, categoryIds);
  const productIds = await upsertProducts(client, productRows);
  console.log(`Produtos sincronizados: ${productIds.size}.`);

  const variantRows = buildVariantRows(products, productIds);
  await upsertVariants(client, variantRows);
  console.log(`Variacoes sincronizadas: ${variantRows.length}.`);

  const imageRows = buildImageRows(products, productIds);
  await upsertImages(client, imageRows);
  console.log(`Imagens sincronizadas: ${imageRows.length}.`);

  console.log('Importacao para Supabase finalizada.');
}

try {
  await importProductsToSupabase();
} catch (error: unknown) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
