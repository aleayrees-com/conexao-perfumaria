create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.product_status as enum ('draft', 'active', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum (
    'unpaid',
    'pending',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  source_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_slug_unique unique (slug),
  constraint categories_name_not_blank check (btrim(name) <> ''),
  constraint categories_slug_not_blank check (slug = btrim(slug) and slug <> ''),
  constraint categories_source_url_http check (source_url is null or source_url ~* '^https?://'),
  constraint categories_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  nuvemshop_product_id bigint not null,
  slug text not null,
  name text not null,
  description text not null default '',
  source_url text,
  status public.product_status not null default 'draft',
  price_cents integer not null default 0,
  compare_at_price_cents integer,
  pix_price_cents integer,
  total_stock integer not null default 0,
  is_available boolean not null default false,
  imported_at timestamptz,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_nuvemshop_product_id_unique unique (nuvemshop_product_id),
  constraint products_slug_unique unique (slug),
  constraint products_slug_not_blank check (slug = btrim(slug) and slug <> ''),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_source_url_http check (source_url is null or source_url ~* '^https?://'),
  constraint products_price_cents_non_negative check (price_cents >= 0),
  constraint products_compare_at_price_valid check (
    compare_at_price_cents is null or compare_at_price_cents >= 0
  ),
  constraint products_pix_price_valid check (pix_price_cents is null or pix_price_cents >= 0),
  constraint products_total_stock_non_negative check (total_stock >= 0),
  constraint products_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.product_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  nuvemshop_variant_id bigint not null,
  sku text,
  label text not null,
  option_values jsonb not null default '{}'::jsonb,
  price_cents integer not null,
  compare_at_price_cents integer,
  pix_price_cents integer,
  stock integer not null default 0,
  is_available boolean not null default false,
  image_url text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_variants_nuvemshop_variant_id_unique unique (nuvemshop_variant_id),
  constraint product_variants_label_not_blank check (btrim(label) <> ''),
  constraint product_variants_sku_not_blank check (sku is null or btrim(sku) <> ''),
  constraint product_variants_price_cents_non_negative check (price_cents >= 0),
  constraint product_variants_compare_at_price_valid check (
    compare_at_price_cents is null or compare_at_price_cents >= 0
  ),
  constraint product_variants_pix_price_valid check (pix_price_cents is null or pix_price_cents >= 0),
  constraint product_variants_stock_non_negative check (stock >= 0),
  constraint product_variants_image_url_http check (image_url is null or image_url ~* '^https?://'),
  constraint product_variants_option_values_object check (jsonb_typeof(option_values) = 'object'),
  constraint product_variants_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.product_images (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_images_product_url_unique unique (product_id, url),
  constraint product_images_url_http check (url ~* '^https?://'),
  constraint product_images_alt_text_not_blank check (alt_text is null or btrim(alt_text) <> ''),
  constraint product_images_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  tax_id text,
  default_shipping_address jsonb not null default '{}'::jsonb,
  marketing_opt_in boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_name_not_blank check (btrim(name) <> ''),
  constraint customers_email_not_blank check (email is null or btrim(email) <> ''),
  constraint customers_phone_not_blank check (phone is null or btrim(phone) <> ''),
  constraint customers_tax_id_not_blank check (tax_id is null or btrim(tax_id) <> ''),
  constraint customers_contact_present check (email is not null or phone is not null),
  constraint customers_default_shipping_address_object check (
    jsonb_typeof(default_shipping_address) = 'object'
  ),
  constraint customers_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create sequence public.order_number_seq as bigint start with 1 increment by 1 no minvalue no maxvalue cache 1;

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_number text not null default ('CP-' || lpad(nextval('public.order_number_seq')::text, 8, '0')),
  customer_id uuid references public.customers (id) on delete set null,
  status public.order_status not null default 'draft',
  payment_status public.payment_status not null default 'unpaid',
  payment_method text,
  currency text not null default 'BRL',
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  notes text,
  admin_notes text,
  source text not null default 'site',
  idempotency_key text,
  placed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_order_number_unique unique (order_number),
  constraint orders_idempotency_key_unique unique (idempotency_key),
  constraint orders_order_number_not_blank check (btrim(order_number) <> ''),
  constraint orders_payment_method_not_blank check (payment_method is null or btrim(payment_method) <> ''),
  constraint orders_currency_iso_4217 check (currency ~ '^[A-Z]{3}$'),
  constraint orders_amounts_non_negative check (
    subtotal_cents >= 0
    and discount_cents >= 0
    and shipping_cents >= 0
    and total_cents >= 0
  ),
  constraint orders_discount_not_above_subtotal check (discount_cents <= subtotal_cents),
  constraint orders_total_matches_parts check (
    total_cents = subtotal_cents - discount_cents + shipping_cents
  ),
  constraint orders_customer_name_not_blank check (customer_name is null or btrim(customer_name) <> ''),
  constraint orders_customer_email_not_blank check (customer_email is null or btrim(customer_email) <> ''),
  constraint orders_customer_phone_not_blank check (customer_phone is null or btrim(customer_phone) <> ''),
  constraint orders_shipping_address_object check (jsonb_typeof(shipping_address) = 'object'),
  constraint orders_billing_address_object check (jsonb_typeof(billing_address) = 'object'),
  constraint orders_source_not_blank check (btrim(source) <> ''),
  constraint orders_idempotency_key_not_blank check (
    idempotency_key is null or btrim(idempotency_key) <> ''
  ),
  constraint orders_metadata_object check (jsonb_typeof(metadata) = 'object')
);

alter sequence public.order_number_seq owned by public.orders.order_number;

create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  nuvemshop_product_id bigint,
  nuvemshop_variant_id bigint,
  sku text,
  product_name text not null,
  variant_label text not null,
  image_url text,
  unit_price_cents integer not null,
  quantity integer not null,
  line_total_cents integer generated always as (unit_price_cents * quantity) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_items_product_name_not_blank check (btrim(product_name) <> ''),
  constraint order_items_variant_label_not_blank check (btrim(variant_label) <> ''),
  constraint order_items_sku_not_blank check (sku is null or btrim(sku) <> ''),
  constraint order_items_image_url_http check (image_url is null or image_url ~* '^https?://'),
  constraint order_items_unit_price_cents_non_negative check (unit_price_cents >= 0),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index categories_parent_category_id_idx on public.categories (parent_category_id);
create index categories_active_sort_idx on public.categories (is_active, sort_order, name);

create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);
create index products_name_lookup_idx on public.products (lower(name));
create index products_public_catalog_idx on public.products (published_at desc, slug)
  where status = 'active' and published_at is not null;
create index products_category_public_idx on public.products (category_id, published_at desc)
  where status = 'active' and published_at is not null;

create index product_variants_product_id_idx on public.product_variants (product_id);
create index product_variants_sku_idx on public.product_variants (sku) where sku is not null;
create index product_variants_product_available_idx on public.product_variants (
  product_id,
  is_available,
  sort_order
);

create index product_images_product_sort_idx on public.product_images (product_id, sort_order);
create index product_images_variant_id_idx on public.product_images (variant_id);
create unique index product_images_one_primary_per_product_idx on public.product_images (product_id)
  where is_primary;

create unique index customers_email_unique_idx on public.customers (lower(email)) where email is not null;
create unique index customers_phone_unique_idx on public.customers (phone) where phone is not null;

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_created_at_idx on public.orders (status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_at_idx on public.orders (created_at desc);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row
  execute function public.set_updated_at();

create trigger product_images_set_updated_at
  before update on public.product_images
  for each row
  execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row
  execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Public can read active categories"
  on public.categories
  for select
  to anon, authenticated
  using (is_active);

create policy "Public can read published products"
  on public.products
  for select
  to anon, authenticated
  using (
    status = 'active'
    and published_at is not null
    and published_at <= now()
  );

create policy "Public can read variants for published products"
  on public.product_variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_variants.product_id
        and products.status = 'active'
        and products.published_at is not null
        and products.published_at <= now()
    )
  );

create policy "Public can read images for published products"
  on public.product_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.status = 'active'
        and products.published_at is not null
        and products.published_at <= now()
    )
  );

grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.product_images to anon, authenticated;

revoke all on public.customers from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

comment on table public.categories is 'Store catalog categories for Conexao Perfumaria.';
comment on table public.products is 'Store products with internal UUIDs and legacy Nuvemshop product IDs.';
comment on table public.product_variants is 'Store purchasable variants with internal UUIDs and legacy Nuvemshop variant IDs.';
comment on table public.product_images is 'Store product and optional variant images.';
comment on table public.customers is 'Store customer records for admin and future checkout flows.';
comment on table public.orders is 'Store order headers with customer snapshots and payment/order status.';
comment on table public.order_items is 'Store order line snapshots for products and variants.';
