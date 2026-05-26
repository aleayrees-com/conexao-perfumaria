import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cache } from 'react';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import productsData from '@/data/products.json';
import {
  buildCategorySummaries,
  sortFeaturedProducts,
} from '@/lib/catalog-utils';
import type {
  CategorySummary,
  Product,
  ProductCategory,
  ProductVariant,
} from '@/types/catalog';

type DbInteger = number | string;

interface SupabaseOperationError {
  readonly message: string;
  readonly details?: string | null;
  readonly hint?: string | null;
  readonly code?: string | null;
}

interface CategoryRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly source_url: string | null;
  readonly is_active: boolean;
}

interface ProductRow extends Record<string, unknown> {
  readonly id: string;
  readonly category_id: string | null;
  readonly nuvemshop_product_id: DbInteger;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly source_url: string | null;
  readonly status: 'draft' | 'active' | 'archived';
  readonly price_cents: DbInteger;
  readonly compare_at_price_cents: DbInteger | null;
  readonly pix_price_cents: DbInteger | null;
  readonly total_stock: DbInteger;
  readonly is_available: boolean;
  readonly imported_at: string | null;
  readonly published_at: string | null;
}

interface ProductVariantRow extends Record<string, unknown> {
  readonly product_id: string;
  readonly nuvemshop_variant_id: DbInteger;
  readonly sku: string | null;
  readonly label: string;
  readonly price_cents: DbInteger;
  readonly compare_at_price_cents: DbInteger | null;
  readonly pix_price_cents: DbInteger | null;
  readonly stock: DbInteger;
  readonly is_available: boolean;
  readonly image_url: string | null;
  readonly sort_order: number;
}

interface ProductImageRow extends Record<string, unknown> {
  readonly product_id: string;
  readonly url: string;
  readonly sort_order: number;
  readonly is_primary: boolean;
}

interface DatabaseTable<Row extends Record<string, unknown>> {
  Row: Row;
  Insert: Record<string, never>;
  Update: Record<string, never>;
  Relationships: [];
}

interface CatalogDatabase {
  public: {
    Tables: {
      categories: DatabaseTable<CategoryRow>;
      products: DatabaseTable<ProductRow>;
      product_variants: DatabaseTable<ProductVariantRow>;
      product_images: DatabaseTable<ProductImageRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

interface SupabaseCatalogEnv {
  readonly url: string;
  readonly serviceRoleKey: string;
}

type CatalogSupabaseClient = SupabaseClient<CatalogDatabase>;

const fallbackProducts = productsData as readonly Product[];
const localDevelopmentCatalogPath = join(
  process.cwd(),
  'src',
  'data',
  'products.local.json',
);

function readBlockedSupabaseProjectRefs(): readonly string[] {
  return (process.env.BLOCKED_SUPABASE_PROJECT_REFS ?? '')
    .split(',')
    .map((projectRef) => projectRef.trim())
    .filter(Boolean);
}

function readSupabaseCatalogEnv(): SupabaseCatalogEnv | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  const blockedProjectRef = readBlockedSupabaseProjectRefs().find(
    (projectRef) => url.includes(projectRef),
  );

  if (blockedProjectRef) {
    throw new Error(
      `Catalogo bloqueado: ${blockedProjectRef} e o Supabase do AlfraOS, nao da Conexao Perfumaria.`,
    );
  }

  return { url, serviceRoleKey };
}

function createCatalogClient(env: SupabaseCatalogEnv): CatalogSupabaseClient {
  return createClient<CatalogDatabase>(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function shouldRequireSupabaseCatalog(): boolean {
  return (
    process.env.VERCEL === '1' || process.env.CATALOG_SOURCE === 'supabase'
  );
}

async function readDevelopmentProducts(): Promise<readonly Product[]> {
  if (process.env.NODE_ENV !== 'development') {
    return fallbackProducts;
  }

  try {
    const rawCatalog = await readFile(localDevelopmentCatalogPath, 'utf8');
    const parsedCatalog = JSON.parse(rawCatalog) as readonly Product[];

    return parsedCatalog;
  } catch {
    return fallbackProducts;
  }
}

function toInteger(value: DbInteger, field: string): number {
  const numberValue =
    typeof value === 'number' ? value : Number.parseInt(value, 10);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Valor numerico invalido em ${field}.`);
  }

  return numberValue;
}

function nullableInteger(
  value: DbInteger | null,
  field: string,
): number | null {
  return value === null ? null : toInteger(value, field);
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

function groupVariantsByProduct(
  rows: readonly ProductVariantRow[],
): ReadonlyMap<string, readonly ProductVariant[]> {
  const variantsByProduct = new Map<string, ProductVariant[]>();

  for (const row of rows) {
    const current = variantsByProduct.get(row.product_id) ?? [];
    current.push({
      id: toInteger(
        row.nuvemshop_variant_id,
        'product_variants.nuvemshop_variant_id',
      ),
      sku: row.sku,
      label: row.label,
      priceCents: toInteger(row.price_cents, 'product_variants.price_cents'),
      compareAtPriceCents: nullableInteger(
        row.compare_at_price_cents,
        'product_variants.compare_at_price_cents',
      ),
      pixPriceCents: nullableInteger(
        row.pix_price_cents,
        'product_variants.pix_price_cents',
      ),
      stock: toInteger(row.stock, 'product_variants.stock'),
      available: row.is_available,
      imageUrl: row.image_url,
    });
    variantsByProduct.set(row.product_id, current);
  }

  return variantsByProduct;
}

function groupImagesByProduct(
  rows: readonly ProductImageRow[],
): ReadonlyMap<string, readonly string[]> {
  const imagesByProduct = new Map<string, string[]>();

  for (const row of rows) {
    const current = imagesByProduct.get(row.product_id) ?? [];
    current.push(row.url);
    imagesByProduct.set(row.product_id, current);
  }

  return imagesByProduct;
}

function mapCategory(
  categoriesById: ReadonlyMap<string, CategoryRow>,
  categoryId: string | null,
): ProductCategory | null {
  if (!categoryId) {
    return null;
  }

  const category = categoriesById.get(categoryId);

  if (!category) {
    return null;
  }

  return {
    name: category.name,
    slug: category.slug,
    url: category.source_url ?? '',
  };
}

function mapProductRowsToProducts({
  categories,
  images,
  products,
  variants,
}: {
  readonly categories: readonly CategoryRow[];
  readonly images: readonly ProductImageRow[];
  readonly products: readonly ProductRow[];
  readonly variants: readonly ProductVariantRow[];
}): readonly Product[] {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const variantsByProduct = groupVariantsByProduct(variants);
  const imagesByProduct = groupImagesByProduct(images);

  return products.map((product) => ({
    id: toInteger(
      product.nuvemshop_product_id,
      'products.nuvemshop_product_id',
    ),
    slug: product.slug,
    name: product.name,
    description: product.description,
    sourceUrl: product.source_url ?? '',
    imageUrls: imagesByProduct.get(product.id) ?? [],
    category: mapCategory(categoriesById, product.category_id),
    variants: variantsByProduct.get(product.id) ?? [],
    priceCents: toInteger(product.price_cents, 'products.price_cents'),
    compareAtPriceCents: nullableInteger(
      product.compare_at_price_cents,
      'products.compare_at_price_cents',
    ),
    pixPriceCents: nullableInteger(
      product.pix_price_cents,
      'products.pix_price_cents',
    ),
    totalStock: toInteger(product.total_stock, 'products.total_stock'),
    available: product.is_available,
    importedAt: product.imported_at ?? product.published_at ?? '',
  }));
}

async function fetchSupabaseProducts(
  client: CatalogSupabaseClient,
): Promise<readonly Product[]> {
  const now = new Date().toISOString();

  const [categoryResponse, productResponse, variantResponse, imageResponse] =
    await Promise.all([
      client
        .from('categories')
        .select('id,name,slug,source_url,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      client
        .from('products')
        .select(
          'id,category_id,nuvemshop_product_id,slug,name,description,source_url,status,price_cents,compare_at_price_cents,pix_price_cents,total_stock,is_available,imported_at,published_at',
        )
        .eq('status', 'active')
        .not('published_at', 'is', null)
        .lte('published_at', now)
        .order('name', { ascending: true }),
      client
        .from('product_variants')
        .select(
          'product_id,nuvemshop_variant_id,sku,label,price_cents,compare_at_price_cents,pix_price_cents,stock,is_available,image_url,sort_order',
        )
        .order('sort_order', { ascending: true }),
      client
        .from('product_images')
        .select('product_id,url,sort_order,is_primary')
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
    ]);

  if (categoryResponse.error) {
    throwSupabaseError('Falha ao carregar categorias', categoryResponse.error);
  }

  if (productResponse.error) {
    throwSupabaseError('Falha ao carregar produtos', productResponse.error);
  }

  if (variantResponse.error) {
    throwSupabaseError('Falha ao carregar variacoes', variantResponse.error);
  }

  if (imageResponse.error) {
    throwSupabaseError('Falha ao carregar imagens', imageResponse.error);
  }

  return mapProductRowsToProducts({
    categories: categoryResponse.data ?? [],
    images: imageResponse.data ?? [],
    products: productResponse.data ?? [],
    variants: variantResponse.data ?? [],
  });
}

async function readProducts(): Promise<readonly Product[]> {
  const env = readSupabaseCatalogEnv();
  const requireSupabaseCatalog = shouldRequireSupabaseCatalog();

  if (!env) {
    if (requireSupabaseCatalog) {
      throw new Error('Supabase obrigatorio para carregar catalogo.');
    }

    return readDevelopmentProducts();
  }

  try {
    return await fetchSupabaseProducts(createCatalogClient(env));
  } catch (error: unknown) {
    if (requireSupabaseCatalog) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : 'erro desconhecido';
    console.warn(
      `Catalogo Supabase indisponivel; usando snapshot local. ${message}`,
    );

    return readDevelopmentProducts();
  }
}

export const getProducts = cache(readProducts);

export async function getSupabaseProductsStrict(): Promise<readonly Product[]> {
  const env = readSupabaseCatalogEnv();

  if (!env) {
    throw new Error('Supabase obrigatorio para fechar pedido.');
  }

  return fetchSupabaseProducts(createCatalogClient(env));
}

export async function getAvailableProducts(): Promise<readonly Product[]> {
  return (await getProducts()).filter((product) => product.available);
}

export async function getFeaturedProducts(
  limit = 12,
): Promise<readonly Product[]> {
  return sortFeaturedProducts(await getProducts(), limit);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return (await getProducts()).find((product) => product.slug === slug) ?? null;
}

export async function getProductsByCategory(
  slug: string,
): Promise<readonly Product[]> {
  return (await getProducts()).filter(
    (product) => product.category?.slug === slug,
  );
}

export async function getCategorySummaries(): Promise<
  readonly CategorySummary[]
> {
  return buildCategorySummaries(await getProducts());
}

export async function getCategoryBySlug(
  slug: string,
): Promise<CategorySummary | null> {
  return (
    (await getCategorySummaries()).find((category) => category.slug === slug) ??
    null
  );
}
