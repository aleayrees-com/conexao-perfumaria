import 'server-only';

import { revalidatePath } from 'next/cache';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

import type { BulkProductCsvExportRow } from '@/lib/admin-product-bulk';
import {
  isSupabaseAdminEnvConfigured,
  isSupabaseDbUrlConfigured,
  readOptionalEnv,
} from '@/lib/admin-env';

type DbInteger = number | string;

interface CategoryAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly is_active: boolean;
  readonly sort_order: number;
}

interface ProductAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly category_id: string | null;
  readonly public_product_id: DbInteger;
  readonly slug: string;
  readonly name: string;
  readonly description?: string | null;
  readonly status: 'draft' | 'active' | 'archived';
  readonly price_cents: DbInteger;
  readonly compare_at_price_cents: DbInteger | null;
  readonly pix_price_cents: DbInteger | null;
  readonly total_stock: DbInteger;
  readonly is_available: boolean;
  readonly shipping_weight_grams?: DbInteger;
  readonly shipping_height_cm?: DbInteger;
  readonly shipping_width_cm?: DbInteger;
  readonly shipping_length_cm?: DbInteger;
  readonly published_at: string | null;
  readonly updated_at: string;
  readonly categories?: Pick<CategoryAdminRow, 'name' | 'slug'> | null;
}

interface ProductVariantAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly product_id: string;
  readonly public_variant_id: DbInteger;
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

interface ProductImageAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly product_id: string;
  readonly variant_id: string | null;
  readonly url: string;
  readonly alt_text: string | null;
  readonly sort_order: number;
  readonly is_primary: boolean;
}

interface AdminAuditLogRow extends Record<string, unknown> {
  readonly id: string;
  readonly actor_email: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

interface OrderAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly order_number: string;
  readonly customer_id?: string | null;
  readonly status:
    | 'draft'
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';
  readonly payment_status:
    | 'unpaid'
    | 'pending'
    | 'paid'
    | 'failed'
    | 'refunded'
    | 'partially_refunded'
    | 'cancelled';
  readonly total_cents: DbInteger;
  readonly subtotal_cents?: DbInteger;
  readonly shipping_cents?: DbInteger;
  readonly payment_method?: string | null;
  readonly customer_name: string | null;
  readonly customer_email?: string | null;
  readonly customer_phone: string | null;
  readonly shipping_address?: Record<string, unknown> | null;
  readonly admin_notes?: string | null;
  readonly source: string;
  readonly created_at: string;
  readonly placed_at: string | null;
  readonly paid_at?: string | null;
  readonly idempotency_key?: string | null;
  readonly metadata?: Record<string, unknown>;
}

interface CustomerAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly tax_id?: string | null;
  readonly default_shipping_address: Record<string, unknown>;
  readonly marketing_opt_in: boolean;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

interface OrderItemAdminRow extends Record<string, unknown> {
  readonly id: string;
  readonly order_id: string;
  readonly product_id?: string | null;
  readonly variant_id?: string | null;
  readonly nuvemshop_product_id?: DbInteger | null;
  readonly nuvemshop_variant_id?: DbInteger | null;
  readonly sku?: string | null;
  readonly product_name: string;
  readonly variant_label: string;
  readonly image_url?: string | null;
  readonly unit_price_cents: DbInteger;
  readonly quantity: DbInteger;
  readonly line_total_cents: DbInteger;
  readonly metadata?: Record<string, unknown>;
}

interface AdminDatabase {
  public: {
    Tables: {
      categories: {
        Row: CategoryAdminRow;
        Insert: Partial<CategoryAdminRow>;
        Update: Partial<CategoryAdminRow>;
        Relationships: [];
      };
      products: {
        Row: ProductAdminRow;
        Insert: Partial<ProductAdminRow>;
        Update: Partial<ProductAdminRow>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariantAdminRow;
        Insert: Partial<ProductVariantAdminRow>;
        Update: Partial<ProductVariantAdminRow>;
        Relationships: [];
      };
      product_images: {
        Row: ProductImageAdminRow;
        Insert: Partial<ProductImageAdminRow>;
        Update: Partial<ProductImageAdminRow>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLogRow;
        Insert: Partial<AdminAuditLogRow>;
        Update: Partial<AdminAuditLogRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderAdminRow;
        Insert: Partial<OrderAdminRow>;
        Update: Partial<OrderAdminRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerAdminRow;
        Insert: Partial<CustomerAdminRow>;
        Update: Partial<CustomerAdminRow>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItemAdminRow;
        Insert: Partial<OrderItemAdminRow>;
        Update: Partial<OrderItemAdminRow>;
        Relationships: [];
      };
      order_events: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      tracking_events: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      refresh_product_stock: {
        Args: { target_product_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type AdminClient = SupabaseClient<AdminDatabase>;
type SupabaseErrorLike = {
  readonly message: string;
  readonly details?: string | null;
  readonly hint?: string | null;
  readonly code?: string | null;
};

const ADMIN_PRODUCT_SELECT_BASE =
  'id,category_id,public_product_id,slug,name,status,price_cents,compare_at_price_cents,pix_price_cents,total_stock,is_available,published_at,updated_at';
const ADMIN_PRODUCT_SELECT_WITH_SHIPPING =
  'id,category_id,public_product_id,slug,name,status,price_cents,compare_at_price_cents,pix_price_cents,total_stock,is_available,shipping_weight_grams,shipping_height_cm,shipping_width_cm,shipping_length_cm,published_at,updated_at';
const ADMIN_PRODUCT_DETAIL_SELECT_BASE =
  'id,category_id,public_product_id,slug,name,description,status,price_cents,compare_at_price_cents,pix_price_cents,total_stock,is_available,published_at,updated_at';
const ADMIN_PRODUCT_DETAIL_SELECT_WITH_SHIPPING =
  'id,category_id,public_product_id,slug,name,description,status,price_cents,compare_at_price_cents,pix_price_cents,total_stock,is_available,shipping_weight_grams,shipping_height_cm,shipping_width_cm,shipping_length_cm,published_at,updated_at';

export interface AdminCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isActive: boolean;
}

export interface AdminProductSummary {
  readonly id: string;
  readonly publicProductId: number;
  readonly name: string;
  readonly slug: string;
  readonly categoryId: string | null;
  readonly categoryName: string;
  readonly status: string;
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly pixPriceCents: number | null;
  readonly totalStock: number;
  readonly isAvailable: boolean;
  readonly shippingWeightGrams: number;
  readonly shippingHeightCm: number;
  readonly shippingWidthCm: number;
  readonly shippingLengthCm: number;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
}

export interface AdminProductDetail extends AdminProductSummary {
  readonly description: string;
  readonly categoryId: string | null;
  readonly compareAtPriceCents: number | null;
  readonly variants: readonly AdminProductVariant[];
  readonly images: readonly AdminProductImage[];
}

export interface AdminProductVariant {
  readonly id: string;
  readonly publicVariantId: number;
  readonly sku: string | null;
  readonly label: string;
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly pixPriceCents: number | null;
  readonly stock: number;
  readonly isAvailable: boolean;
  readonly imageUrl: string | null;
}

export interface AdminProductImage {
  readonly id: string;
  readonly url: string;
  readonly altText: string | null;
  readonly isPrimary: boolean;
  readonly sortOrder: number;
}

export interface AdminOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly subtotalCents: number;
  readonly shippingCents: number;
  readonly totalCents: number;
  readonly customerName: string;
  readonly customerEmail: string | null;
  readonly customerPhone: string | null;
  readonly source: string;
  readonly createdAt: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  readonly adminNotes: string;
  readonly shippingAddress: AdminOrderShippingAddress | null;
  readonly shippingQuote: AdminOrderShippingQuote | null;
  readonly trackingCode: string | null;
  readonly shippingLabelUrl: string | null;
  readonly items: readonly AdminOrderItem[];
}

export interface AdminOrderShippingAddress {
  readonly cep: string | null;
  readonly street: string | null;
  readonly number: string | null;
  readonly neighborhood: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly complement: string | null;
}

export interface AdminOrderShippingQuote {
  readonly id: string;
  readonly provider: string;
  readonly serviceName: string;
  readonly priceCents: number;
  readonly deliveryMinDays: number | null;
  readonly deliveryMaxDays: number | null;
}

export interface AdminOrderItem {
  readonly id: string;
  readonly productName: string;
  readonly variantLabel: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
  readonly lineTotalCents: number;
}

function readSupabaseAdminEnv(): {
  readonly url: string;
  readonly key: string;
} {
  const url = readOptionalEnv(process.env, 'SUPABASE_URL');
  const key = readOptionalEnv(process.env, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Supabase admin env nao configurado.');
  }

  return { url, key };
}

function readSupabaseDbUrl(): string {
  const dbUrl = readOptionalEnv(process.env, 'SUPABASE_DB_URL');

  if (!dbUrl) {
    throw new Error('Supabase DB env nao configurado.');
  }

  return dbUrl;
}

function shouldUseAdminPgClient(): boolean {
  return (
    !isSupabaseAdminEnvConfigured(process.env) &&
    isSupabaseDbUrlConfigured(process.env)
  );
}

export function createAdminClient(): AdminClient {
  const env = readSupabaseAdminEnv();

  return createClient<AdminDatabase>(env.url, env.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createAdminPgClient(): pg.Client {
  const url = new URL(readSupabaseDbUrl());

  return new pg.Client({
    host: url.hostname,
    port: Number(url.port || '5432'),
    database: decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres'),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

async function withAdminPgClient<T>(
  callback: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = createAdminPgClient();

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
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

function optionalInteger(
  value: DbInteger | null | undefined,
  fallback: number,
  field: string,
): number {
  return value === null || value === undefined
    ? fallback
    : toInteger(value, field);
}

function toDateText(value: Date | string | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalText(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function mapShippingAddress(
  value: Record<string, unknown> | null | undefined,
): AdminOrderShippingAddress | null {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return null;
  }

  return {
    cep: readOptionalText(value, 'cep'),
    street: readOptionalText(value, 'street'),
    number: readOptionalText(value, 'number'),
    neighborhood: readOptionalText(value, 'neighborhood'),
    city: readOptionalText(value, 'city'),
    state: readOptionalText(value, 'state'),
    complement: readOptionalText(value, 'complement'),
  };
}

function mapShippingMetadata(metadata: unknown): {
  readonly quote: AdminOrderShippingQuote | null;
  readonly trackingCode: string | null;
  readonly labelUrl: string | null;
} {
  const metadataRecord = isRecord(metadata) ? metadata : {};
  const shipping = isRecord(metadataRecord.shipping)
    ? metadataRecord.shipping
    : {};
  const selectedQuote = isRecord(shipping.selectedQuote)
    ? shipping.selectedQuote
    : null;

  return {
    quote: selectedQuote
      ? {
          id: readOptionalText(selectedQuote, 'id') ?? 'manual-standard',
          provider: readOptionalText(selectedQuote, 'provider') ?? 'manual',
          serviceName:
            readOptionalText(selectedQuote, 'serviceName') ??
            'Entrega combinada',
          priceCents: readOptionalNumber(selectedQuote.priceCents) ?? 0,
          deliveryMinDays: readOptionalNumber(selectedQuote.deliveryMinDays),
          deliveryMaxDays: readOptionalNumber(selectedQuote.deliveryMaxDays),
        }
      : null,
    trackingCode: readOptionalText(shipping, 'trackingCode'),
    labelUrl: readOptionalText(shipping, 'labelUrl'),
  };
}

function assertSupabaseSuccess<T>(
  response: {
    readonly data: T;
    readonly error: { readonly message: string } | null;
  },
  context: string,
): T {
  if (response.error) {
    throw new Error(`${context}: ${response.error.message}`);
  }

  return response.data;
}

function isMissingShippingColumnError(
  error: SupabaseErrorLike | null,
): boolean {
  if (!error) {
    return false;
  }

  const haystack = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(' ');

  return /shipping_(weight_grams|height_cm|width_cm|length_cm)/i.test(haystack);
}

async function readCategoryNameMap(
  client: AdminClient,
): Promise<ReadonlyMap<string, string>> {
  const response = await client.from('categories').select('id,name');
  const categories =
    assertSupabaseSuccess(response, 'Falha ao carregar categorias') ?? [];

  return new Map(categories.map((category) => [category.id, category.name]));
}

async function listAdminCategoriesFromPg(
  client: pg.Client,
): Promise<readonly AdminCategory[]> {
  const result = await client.query<CategoryAdminRow>(`
    select id, name, slug, is_active, sort_order
    from public.categories
    order by sort_order asc, name asc
  `);

  return result.rows.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    isActive: category.is_active,
  }));
}

async function hasProductShippingColumnsFromPg(
  client: pg.Client,
): Promise<boolean> {
  const result = await client.query<{ count: number }>(
    `
      select count(*)::int as count
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = any($1::text[])
    `,
    [
      [
        'shipping_weight_grams',
        'shipping_height_cm',
        'shipping_width_cm',
        'shipping_length_cm',
      ],
    ],
  );

  return result.rows[0]?.count === 4;
}

function getProductShippingSelect(hasShippingColumns: boolean): string {
  if (hasShippingColumns) {
    return `
      p.shipping_weight_grams,
      p.shipping_height_cm,
      p.shipping_width_cm,
      p.shipping_length_cm
    `;
  }

  return `
    null::integer as shipping_weight_grams,
    null::integer as shipping_height_cm,
    null::integer as shipping_width_cm,
    null::integer as shipping_length_cm
  `;
}

async function listAdminProductsFromPg(
  client: pg.Client,
): Promise<readonly AdminProductSummary[]> {
  const productShippingSelect = getProductShippingSelect(
    await hasProductShippingColumnsFromPg(client),
  );
  const result = await client.query<
    ProductAdminRow & { category_name: string }
  >(
    `
      select
        p.id,
        p.category_id,
        p.public_product_id,
        p.slug,
        p.name,
        p.status,
        p.price_cents,
        p.compare_at_price_cents,
        p.pix_price_cents,
        p.total_stock,
        p.is_available,
        ${productShippingSelect},
        p.published_at::text as published_at,
        p.updated_at::text as updated_at,
        coalesce(c.name, 'Sem categoria') as category_name
      from public.products p
      left join public.categories c on c.id = p.category_id
      order by p.updated_at desc
    `,
  );

  return result.rows.map((product) =>
    mapProductSummary(product, product.category_name),
  );
}

async function getAdminProductFromPg(
  client: pg.Client,
  productId: string,
): Promise<AdminProductDetail | null> {
  const productShippingSelect = getProductShippingSelect(
    await hasProductShippingColumnsFromPg(client),
  );
  const productResult = await client.query<
    ProductAdminRow & { category_name: string }
  >(
    `
      select
        p.id,
        p.category_id,
        p.public_product_id,
        p.slug,
        p.name,
        p.description,
        p.status,
        p.price_cents,
        p.compare_at_price_cents,
        p.pix_price_cents,
        p.total_stock,
        p.is_available,
        ${productShippingSelect},
        p.published_at::text as published_at,
        p.updated_at::text as updated_at,
        coalesce(c.name, 'Sem categoria') as category_name
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.id = $1
      limit 1
    `,
    [productId],
  );
  const product = productResult.rows[0];

  if (!product) {
    return null;
  }

  const [variantResult, imageResult] = await Promise.all([
    client.query<ProductVariantAdminRow>(
      `
        select
          id,
          product_id,
          public_variant_id,
          sku,
          label,
          price_cents,
          compare_at_price_cents,
          pix_price_cents,
          stock,
          is_available,
          image_url,
          sort_order
        from public.product_variants
        where product_id = $1
        order by sort_order asc
      `,
      [productId],
    ),
    client.query<ProductImageAdminRow>(
      `
        select id, product_id, variant_id, url, alt_text, sort_order, is_primary
        from public.product_images
        where product_id = $1
        order by is_primary desc, sort_order asc
      `,
      [productId],
    ),
  ]);
  const summary = mapProductSummary(product, product.category_name);

  return {
    ...summary,
    description:
      typeof product.description === 'string' ? product.description : '',
    categoryId: product.category_id,
    compareAtPriceCents: nullableInteger(
      product.compare_at_price_cents,
      'products.compare_at_price_cents',
    ),
    variants: variantResult.rows.map((variant) => ({
      id: variant.id,
      publicVariantId: toInteger(
        variant.public_variant_id,
        'product_variants.public_variant_id',
      ),
      sku: variant.sku,
      label: variant.label,
      priceCents: toInteger(
        variant.price_cents,
        'product_variants.price_cents',
      ),
      compareAtPriceCents: nullableInteger(
        variant.compare_at_price_cents,
        'product_variants.compare_at_price_cents',
      ),
      pixPriceCents: nullableInteger(
        variant.pix_price_cents,
        'product_variants.pix_price_cents',
      ),
      stock: toInteger(variant.stock, 'product_variants.stock'),
      isAvailable: variant.is_available,
      imageUrl: variant.image_url,
    })),
    images: imageResult.rows.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.alt_text,
      isPrimary: image.is_primary,
      sortOrder: image.sort_order,
    })),
  };
}

async function listAdminProductBulkRowsFromPg(
  client: pg.Client,
): Promise<readonly BulkProductCsvExportRow[]> {
  const [productResult, variantResult] = await Promise.all([
    client.query<ProductAdminRow>(`
      select
        id,
        category_id,
        slug,
        name,
        status,
        price_cents,
        compare_at_price_cents,
        pix_price_cents,
        total_stock,
        is_available,
        public_product_id,
        published_at::text as published_at,
        updated_at::text as updated_at
      from public.products
      order by name asc
    `),
    client.query<ProductVariantAdminRow>(`
      select
        id,
        product_id,
        public_variant_id,
        sku,
        label,
        price_cents,
        compare_at_price_cents,
        pix_price_cents,
        stock,
        is_available,
        image_url,
        sort_order
      from public.product_variants
      order by sort_order asc
    `),
  ]);
  const variantsByProduct = new Map<string, ProductVariantAdminRow[]>();

  for (const variant of variantResult.rows) {
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  }

  return productResult.rows.flatMap((product) => {
    const productVariants = variantsByProduct.get(product.id) ?? [];
    const productPriceCents = toInteger(
      product.price_cents,
      'products.price_cents',
    );
    const productPixPriceCents = nullableInteger(
      product.pix_price_cents,
      'products.pix_price_cents',
    );
    const productCompareAtPriceCents = nullableInteger(
      product.compare_at_price_cents,
      'products.compare_at_price_cents',
    );

    if (productVariants.length === 0) {
      return [
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          status: product.status,
          categoryId: product.category_id,
          priceCents: productPriceCents,
          pixPriceCents: productPixPriceCents,
          compareAtPriceCents: productCompareAtPriceCents,
          variantId: '',
          variantLabel: '',
          variantSku: null,
          variantPriceCents: productPriceCents,
          variantPixPriceCents: productPixPriceCents,
          variantCompareAtPriceCents: productCompareAtPriceCents,
          variantStock: toInteger(product.total_stock, 'products.total_stock'),
          variantAvailable: product.is_available,
        },
      ];
    }

    return productVariants.map((variant) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      status: product.status,
      categoryId: product.category_id,
      priceCents: productPriceCents,
      pixPriceCents: productPixPriceCents,
      compareAtPriceCents: productCompareAtPriceCents,
      variantId: variant.id,
      variantLabel: variant.label,
      variantSku: variant.sku,
      variantPriceCents: toInteger(
        variant.price_cents,
        'product_variants.price_cents',
      ),
      variantPixPriceCents: nullableInteger(
        variant.pix_price_cents,
        'product_variants.pix_price_cents',
      ),
      variantCompareAtPriceCents: nullableInteger(
        variant.compare_at_price_cents,
        'product_variants.compare_at_price_cents',
      ),
      variantStock: toInteger(variant.stock, 'product_variants.stock'),
      variantAvailable: variant.is_available,
    }));
  });
}

function mapOrderSummary(order: OrderAdminRow): AdminOrderSummary {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotalCents: optionalInteger(
      order.subtotal_cents,
      0,
      'orders.subtotal_cents',
    ),
    shippingCents: optionalInteger(
      order.shipping_cents,
      0,
      'orders.shipping_cents',
    ),
    totalCents: toInteger(order.total_cents, 'orders.total_cents'),
    customerName: order.customer_name ?? 'Cliente sem nome',
    customerEmail:
      typeof order.customer_email === 'string' ? order.customer_email : null,
    customerPhone: order.customer_phone,
    source: order.source,
    createdAt: toDateText(order.placed_at ?? order.created_at),
  };
}

async function listAdminOrdersFromPg(
  client: pg.Client,
): Promise<readonly AdminOrderSummary[]> {
  const result = await client.query<OrderAdminRow>(`
    select
      id,
      order_number,
      status::text as status,
      payment_status::text as payment_status,
      subtotal_cents,
      shipping_cents,
      total_cents,
      customer_name,
      customer_email,
      customer_phone,
      admin_notes,
      source,
      created_at::text as created_at,
      placed_at::text as placed_at
    from public.orders
    order by created_at desc
    limit 100
  `);

  return result.rows.map(mapOrderSummary);
}

async function getAdminOrderFromPg(
  client: pg.Client,
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const orderResult = await client.query<OrderAdminRow>(
    `
      select
        id,
        order_number,
        status::text as status,
        payment_status::text as payment_status,
        subtotal_cents,
        shipping_cents,
        total_cents,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        admin_notes,
        source,
        created_at::text as created_at,
        placed_at::text as placed_at,
        metadata
      from public.orders
      where order_number = $1
      limit 1
    `,
    [orderNumber],
  );
  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  const itemsResult = await client.query<OrderItemAdminRow>(
    `
      select
        id,
        order_id,
        product_name,
        variant_label,
        unit_price_cents,
        quantity,
        line_total_cents
      from public.order_items
      where order_id = $1
    `,
    [order.id],
  );
  const shipping = mapShippingMetadata(order.metadata);

  return {
    ...mapOrderSummary(order),
    adminNotes: typeof order.admin_notes === 'string' ? order.admin_notes : '',
    shippingAddress: mapShippingAddress(order.shipping_address),
    shippingQuote: shipping.quote,
    trackingCode: shipping.trackingCode,
    shippingLabelUrl: shipping.labelUrl,
    items: itemsResult.rows.map((item) => ({
      id: item.id,
      productName: item.product_name,
      variantLabel: item.variant_label,
      unitPriceCents: toInteger(
        item.unit_price_cents,
        'order_items.unit_price_cents',
      ),
      quantity: toInteger(item.quantity, 'order_items.quantity'),
      lineTotalCents: toInteger(
        item.line_total_cents,
        'order_items.line_total_cents',
      ),
    })),
  };
}

function mapProductSummary(
  row: ProductAdminRow,
  categoryName = row.categories?.name ?? 'Sem categoria',
): AdminProductSummary {
  return {
    id: row.id,
    publicProductId: toInteger(
      row.public_product_id,
      'products.public_product_id',
    ),
    name: row.name,
    slug: row.slug,
    categoryId: row.category_id,
    categoryName,
    status: row.status,
    priceCents: toInteger(row.price_cents, 'products.price_cents'),
    compareAtPriceCents: nullableInteger(
      row.compare_at_price_cents,
      'products.compare_at_price_cents',
    ),
    pixPriceCents: nullableInteger(
      row.pix_price_cents,
      'products.pix_price_cents',
    ),
    totalStock: toInteger(row.total_stock, 'products.total_stock'),
    isAvailable: row.is_available,
    shippingWeightGrams: optionalInteger(
      row.shipping_weight_grams,
      250,
      'products.shipping_weight_grams',
    ),
    shippingHeightCm: optionalInteger(
      row.shipping_height_cm,
      8,
      'products.shipping_height_cm',
    ),
    shippingWidthCm: optionalInteger(
      row.shipping_width_cm,
      8,
      'products.shipping_width_cm',
    ),
    shippingLengthCm: optionalInteger(
      row.shipping_length_cm,
      16,
      'products.shipping_length_cm',
    ),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminCategories(): Promise<readonly AdminCategory[]> {
  if (shouldUseAdminPgClient()) {
    return withAdminPgClient(listAdminCategoriesFromPg);
  }

  const response = await createAdminClient()
    .from('categories')
    .select('id,name,slug,is_active,sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const categories =
    assertSupabaseSuccess(response, 'Falha ao listar categorias') ?? [];

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    isActive: category.is_active,
  }));
}

export async function listAdminProducts(): Promise<
  readonly AdminProductSummary[]
> {
  if (shouldUseAdminPgClient()) {
    return withAdminPgClient(listAdminProductsFromPg);
  }

  const client = createAdminClient();
  const response = await client
    .from('products')
    .select(ADMIN_PRODUCT_SELECT_WITH_SHIPPING)
    .order('updated_at', { ascending: false });
  const productResponse = isMissingShippingColumnError(response.error)
    ? await client
        .from('products')
        .select(ADMIN_PRODUCT_SELECT_BASE)
        .order('updated_at', { ascending: false })
    : response;

  const products =
    assertSupabaseSuccess(productResponse, 'Falha ao listar produtos') ?? [];
  const categoryNameMap = await readCategoryNameMap(client);

  return products.map((product) =>
    mapProductSummary(
      product,
      product.category_id
        ? (categoryNameMap.get(product.category_id) ?? 'Sem categoria')
        : 'Sem categoria',
    ),
  );
}

export async function getAdminProduct(
  productId: string,
): Promise<AdminProductDetail | null> {
  if (shouldUseAdminPgClient()) {
    return withAdminPgClient((client) =>
      getAdminProductFromPg(client, productId),
    );
  }

  const client = createAdminClient();
  const initialProductResponse = await client
    .from('products')
    .select(ADMIN_PRODUCT_DETAIL_SELECT_WITH_SHIPPING)
    .eq('id', productId)
    .maybeSingle();
  const productResponse = isMissingShippingColumnError(
    initialProductResponse.error,
  )
    ? await client
        .from('products')
        .select(ADMIN_PRODUCT_DETAIL_SELECT_BASE)
        .eq('id', productId)
        .maybeSingle()
    : initialProductResponse;

  const product = assertSupabaseSuccess(
    productResponse,
    'Falha ao carregar produto',
  );

  if (!product) {
    return null;
  }

  const [variantResponse, imageResponse] = await Promise.all([
    client
      .from('product_variants')
      .select(
        'id,product_id,public_variant_id,sku,label,price_cents,compare_at_price_cents,pix_price_cents,stock,is_available,image_url,sort_order',
      )
      .eq('product_id', productId)
      .order('sort_order', { ascending: true }),
    client
      .from('product_images')
      .select('id,product_id,variant_id,url,alt_text,sort_order,is_primary')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true }),
  ]);
  const categoryNameMap = await readCategoryNameMap(client);
  const summary = mapProductSummary(
    product,
    product.category_id
      ? (categoryNameMap.get(product.category_id) ?? 'Sem categoria')
      : 'Sem categoria',
  );

  return {
    ...summary,
    description:
      typeof product.description === 'string' ? product.description : '',
    categoryId: product.category_id,
    compareAtPriceCents: nullableInteger(
      product.compare_at_price_cents,
      'products.compare_at_price_cents',
    ),
    variants: (
      assertSupabaseSuccess(variantResponse, 'Falha ao carregar variacoes') ??
      []
    ).map((variant) => ({
      id: variant.id,
      publicVariantId: toInteger(
        variant.public_variant_id,
        'product_variants.public_variant_id',
      ),
      sku: variant.sku,
      label: variant.label,
      priceCents: toInteger(
        variant.price_cents,
        'product_variants.price_cents',
      ),
      compareAtPriceCents: nullableInteger(
        variant.compare_at_price_cents,
        'product_variants.compare_at_price_cents',
      ),
      pixPriceCents: nullableInteger(
        variant.pix_price_cents,
        'product_variants.pix_price_cents',
      ),
      stock: toInteger(variant.stock, 'product_variants.stock'),
      isAvailable: variant.is_available,
      imageUrl: variant.image_url,
    })),
    images: (
      assertSupabaseSuccess(imageResponse, 'Falha ao carregar imagens') ?? []
    ).map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.alt_text,
      isPrimary: image.is_primary,
      sortOrder: image.sort_order,
    })),
  };
}

export async function listAdminProductBulkRows(): Promise<
  readonly BulkProductCsvExportRow[]
> {
  if (shouldUseAdminPgClient()) {
    return withAdminPgClient(listAdminProductBulkRowsFromPg);
  }

  const client = createAdminClient();
  const [productResponse, variantResponse] = await Promise.all([
    client
      .from('products')
      .select(
        'id,category_id,slug,name,status,price_cents,compare_at_price_cents,pix_price_cents,total_stock,is_available',
      )
      .order('name', { ascending: true }),
    client
      .from('product_variants')
      .select(
        'id,product_id,public_variant_id,sku,label,price_cents,compare_at_price_cents,pix_price_cents,stock,is_available,image_url,sort_order',
      )
      .order('sort_order', { ascending: true }),
  ]);

  const products =
    assertSupabaseSuccess(productResponse, 'Falha ao listar produtos') ?? [];
  const variants =
    assertSupabaseSuccess(variantResponse, 'Falha ao listar variacoes') ?? [];
  const variantsByProduct = new Map<string, ProductVariantAdminRow[]>();

  for (const variant of variants) {
    const current = variantsByProduct.get(variant.product_id) ?? [];
    current.push(variant);
    variantsByProduct.set(variant.product_id, current);
  }

  return products.flatMap((product) => {
    const productVariants = variantsByProduct.get(product.id) ?? [];
    const productPriceCents = toInteger(
      product.price_cents,
      'products.price_cents',
    );
    const productPixPriceCents = nullableInteger(
      product.pix_price_cents,
      'products.pix_price_cents',
    );
    const productCompareAtPriceCents = nullableInteger(
      product.compare_at_price_cents,
      'products.compare_at_price_cents',
    );

    if (productVariants.length === 0) {
      return [
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          status: product.status,
          categoryId: product.category_id,
          priceCents: productPriceCents,
          pixPriceCents: productPixPriceCents,
          compareAtPriceCents: productCompareAtPriceCents,
          variantId: '',
          variantLabel: '',
          variantSku: null,
          variantPriceCents: productPriceCents,
          variantPixPriceCents: productPixPriceCents,
          variantCompareAtPriceCents: productCompareAtPriceCents,
          variantStock: toInteger(product.total_stock, 'products.total_stock'),
          variantAvailable: product.is_available,
        },
      ];
    }

    return productVariants.map((variant) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      status: product.status,
      categoryId: product.category_id,
      priceCents: productPriceCents,
      pixPriceCents: productPixPriceCents,
      compareAtPriceCents: productCompareAtPriceCents,
      variantId: variant.id,
      variantLabel: variant.label,
      variantSku: variant.sku,
      variantPriceCents: toInteger(
        variant.price_cents,
        'product_variants.price_cents',
      ),
      variantPixPriceCents: nullableInteger(
        variant.pix_price_cents,
        'product_variants.pix_price_cents',
      ),
      variantCompareAtPriceCents: nullableInteger(
        variant.compare_at_price_cents,
        'product_variants.compare_at_price_cents',
      ),
      variantStock: toInteger(variant.stock, 'product_variants.stock'),
      variantAvailable: variant.is_available,
    }));
  });
}

export async function insertAdminAuditLog(
  client: AdminClient,
  input: {
    readonly action: string;
    readonly entityType: string;
    readonly entityId?: string | null;
    readonly metadata: Record<string, unknown>;
  },
): Promise<void> {
  const response = await client.from('admin_audit_logs').insert({
    actor_email: 'admin',
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata,
  });

  if (response.error) {
    throw new Error(`Falha ao registrar auditoria: ${response.error.message}`);
  }
}

export async function listAdminOrders(): Promise<readonly AdminOrderSummary[]> {
  if (shouldUseAdminPgClient()) {
    return withAdminPgClient(listAdminOrdersFromPg);
  }

  const response = await createAdminClient()
    .from('orders')
    .select(
      'id,order_number,status,payment_status,subtotal_cents,shipping_cents,total_cents,customer_name,customer_email,customer_phone,admin_notes,source,created_at,placed_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const orders =
    assertSupabaseSuccess(response, 'Falha ao listar pedidos') ?? [];

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotalCents: optionalInteger(
      order.subtotal_cents,
      0,
      'orders.subtotal_cents',
    ),
    shippingCents: optionalInteger(
      order.shipping_cents,
      0,
      'orders.shipping_cents',
    ),
    totalCents: toInteger(order.total_cents, 'orders.total_cents'),
    customerName: order.customer_name ?? 'Cliente sem nome',
    customerEmail:
      typeof order.customer_email === 'string' ? order.customer_email : null,
    customerPhone: order.customer_phone,
    adminNotes: typeof order.admin_notes === 'string' ? order.admin_notes : '',
    source: order.source,
    createdAt: order.placed_at ?? order.created_at,
  }));
}

export async function getAdminOrder(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  if (shouldUseAdminPgClient()) {
    return withAdminPgClient((client) =>
      getAdminOrderFromPg(client, orderNumber),
    );
  }

  const client = createAdminClient();
  const orderResponse = await client
    .from('orders')
    .select(
      'id,order_number,status,payment_status,subtotal_cents,shipping_cents,total_cents,customer_name,customer_email,customer_phone,shipping_address,admin_notes,source,created_at,placed_at,metadata',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();
  const order = assertSupabaseSuccess(
    orderResponse,
    'Falha ao carregar pedido',
  );

  if (!order) {
    return null;
  }

  const itemsResponse = await client
    .from('order_items')
    .select(
      'id,order_id,product_name,variant_label,unit_price_cents,quantity,line_total_cents',
    )
    .eq('order_id', order.id);

  const shipping = mapShippingMetadata(order.metadata);

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    subtotalCents: optionalInteger(
      order.subtotal_cents,
      0,
      'orders.subtotal_cents',
    ),
    shippingCents: optionalInteger(
      order.shipping_cents,
      0,
      'orders.shipping_cents',
    ),
    totalCents: toInteger(order.total_cents, 'orders.total_cents'),
    customerName: order.customer_name ?? 'Cliente sem nome',
    customerEmail:
      typeof order.customer_email === 'string' ? order.customer_email : null,
    customerPhone: order.customer_phone,
    adminNotes: typeof order.admin_notes === 'string' ? order.admin_notes : '',
    source: order.source,
    createdAt: order.placed_at ?? order.created_at,
    shippingAddress: mapShippingAddress(order.shipping_address),
    shippingQuote: shipping.quote,
    trackingCode: shipping.trackingCode,
    shippingLabelUrl: shipping.labelUrl,
    items: (
      assertSupabaseSuccess(itemsResponse, 'Falha ao carregar itens') ?? []
    ).map((item) => ({
      id: item.id,
      productName: item.product_name,
      variantLabel: item.variant_label,
      unitPriceCents: toInteger(
        item.unit_price_cents,
        'order_items.unit_price_cents',
      ),
      quantity: toInteger(item.quantity, 'order_items.quantity'),
      lineTotalCents: toInteger(
        item.line_total_cents,
        'order_items.line_total_cents',
      ),
    })),
  };
}

export function revalidateStorefrontCatalog(): void {
  revalidatePath('/');
  revalidatePath('/produtos');
  revalidatePath('/categoria/[slug]', 'page');
  revalidatePath('/produtos/[slug]', 'page');
}
