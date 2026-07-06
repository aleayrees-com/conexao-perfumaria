create sequence if not exists public.product_public_id_seq as bigint start with 1000000000000 increment by 1;
create sequence if not exists public.product_variant_public_id_seq as bigint start with 2000000000000 increment by 1;

alter table public.products
  add column if not exists public_product_id bigint;

update public.products
set public_product_id = coalesce(nuvemshop_product_id, nextval('public.product_public_id_seq'))
where public_product_id is null;

alter table public.products
  alter column public_product_id set default nextval('public.product_public_id_seq'),
  alter column public_product_id set not null,
  alter column nuvemshop_product_id drop not null;

create unique index if not exists products_public_product_id_unique_idx
  on public.products (public_product_id);

alter table public.product_variants
  add column if not exists public_variant_id bigint;

update public.product_variants
set public_variant_id = coalesce(nuvemshop_variant_id, nextval('public.product_variant_public_id_seq'))
where public_variant_id is null;

alter table public.product_variants
  alter column public_variant_id set default nextval('public.product_variant_public_id_seq'),
  alter column public_variant_id set not null,
  alter column nuvemshop_variant_id drop not null;

create unique index if not exists product_variants_public_variant_id_unique_idx
  on public.product_variants (public_variant_id);

create table if not exists public.admin_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null,
  display_name text not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_profiles_email_unique unique (email),
  constraint admin_profiles_email_not_blank check (btrim(email) <> ''),
  constraint admin_profiles_display_name_not_blank check (btrim(display_name) <> ''),
  constraint admin_profiles_role_valid check (role in ('owner', 'admin', 'operator'))
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint admin_audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint admin_audit_logs_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint admin_audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.order_events (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_events_event_type_not_blank check (btrim(event_type) <> ''),
  constraint order_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.tracking_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id text not null,
  event_name text not null,
  order_id uuid references public.orders (id) on delete set null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,

  constraint tracking_events_event_id_unique unique (event_id),
  constraint tracking_events_event_id_not_blank check (btrim(event_id) <> ''),
  constraint tracking_events_event_name_not_blank check (btrim(event_name) <> ''),
  constraint tracking_events_status_valid check (status in ('pending', 'sent', 'failed', 'skipped')),
  constraint tracking_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint tracking_events_provider_response_object check (
    jsonb_typeof(provider_response) = 'object'
  )
);

create index if not exists order_events_order_id_created_at_idx
  on public.order_events (order_id, created_at desc);

create index if not exists tracking_events_order_id_idx
  on public.tracking_events (order_id);

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
  before update on public.admin_profiles
  for each row
  execute function public.set_updated_at();

alter table public.admin_profiles enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.order_events enable row level security;
alter table public.tracking_events enable row level security;

revoke all on public.admin_profiles from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
revoke all on public.order_events from anon, authenticated;
revoke all on public.tracking_events from anon, authenticated;

create or replace function public.refresh_product_stock(target_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set
    total_stock = coalesce(
      (
        select sum(stock)
        from public.product_variants
        where product_id = target_product_id
      ),
      0
    ),
    is_available = exists (
      select 1
      from public.product_variants
      where product_id = target_product_id
        and is_available = true
        and stock > 0
    )
  where id = target_product_id;
end;
$$;

create or replace function public.refresh_product_stock_from_variant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_product_stock(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists product_variants_refresh_product_stock_insert on public.product_variants;
create trigger product_variants_refresh_product_stock_insert
  after insert on public.product_variants
  for each row
  execute function public.refresh_product_stock_from_variant();

drop trigger if exists product_variants_refresh_product_stock_update on public.product_variants;
create trigger product_variants_refresh_product_stock_update
  after update of stock, is_available on public.product_variants
  for each row
  execute function public.refresh_product_stock_from_variant();

drop trigger if exists product_variants_refresh_product_stock_delete on public.product_variants;
create trigger product_variants_refresh_product_stock_delete
  after delete on public.product_variants
  for each row
  execute function public.refresh_product_stock_from_variant();

comment on table public.admin_profiles is 'Admin users allowed to operate the internal panel.';
comment on table public.admin_audit_logs is 'Audit trail for internal administrative changes.';
comment on table public.order_events is 'Timeline of order status/payment/admin events.';
comment on table public.tracking_events is 'Server-side tracking delivery log for ads integrations.';
