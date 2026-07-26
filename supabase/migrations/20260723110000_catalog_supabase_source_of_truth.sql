select public.unschedule_inventory_sync_cron();

revoke all on function public.sync_catalog_from_google_sheet(boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.sync_inventory_from_google_sheet(boolean)
  from public, anon, authenticated, service_role;

create table public.catalog_sheet_projection_state (
  singleton boolean primary key default true check (singleton),
  requested_version bigint not null default 1 check (requested_version >= 1),
  completed_version bigint not null default 0 check (completed_version >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint catalog_sheet_projection_versions_valid
    check (completed_version <= requested_version)
);

insert into public.catalog_sheet_projection_state (singleton)
values (true);

alter table public.catalog_sheet_projection_state enable row level security;
revoke all on public.catalog_sheet_projection_state
  from public, anon, authenticated;
grant all on public.catalog_sheet_projection_state to service_role;

create or replace function public.request_catalog_sheet_projection()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.catalog_sheet_projection_state
  set
    requested_version = requested_version + 1,
    requested_at = now(),
    last_error = null
  where singleton;
end;
$$;

create or replace function public.enqueue_catalog_sheet_projection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.request_catalog_sheet_projection();
  return null;
end;
$$;

drop trigger if exists products_enqueue_catalog_sheet_projection on public.products;
create trigger products_enqueue_catalog_sheet_projection
  after insert or update or delete on public.products
  for each statement
  execute function public.enqueue_catalog_sheet_projection();

drop trigger if exists product_variants_enqueue_catalog_sheet_projection on public.product_variants;
create trigger product_variants_enqueue_catalog_sheet_projection
  after insert or update or delete on public.product_variants
  for each statement
  execute function public.enqueue_catalog_sheet_projection();

drop trigger if exists categories_enqueue_catalog_sheet_projection on public.categories;
create trigger categories_enqueue_catalog_sheet_projection
  after insert or update or delete on public.categories
  for each statement
  execute function public.enqueue_catalog_sheet_projection();

create or replace function public.claim_catalog_sheet_projection()
returns table (
  lease_token uuid,
  version bigint
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  return query
  update public.catalog_sheet_projection_state as projection
  set
    lease_token = extensions.gen_random_uuid(),
    lease_expires_at = now() + interval '5 minutes',
    last_error = null
  where projection.singleton
    and projection.completed_version < projection.requested_version
    and (
      projection.lease_token is null
      or projection.lease_expires_at is null
      or projection.lease_expires_at < now()
    )
  returning projection.lease_token, projection.requested_version;
end;
$$;

create or replace function public.complete_catalog_sheet_projection(
  claimed_lease_token uuid,
  claimed_version bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.catalog_sheet_projection_state
  set
    completed_version = claimed_version,
    completed_at = now(),
    lease_token = null,
    lease_expires_at = null,
    last_error = null
  where singleton
    and lease_token = claimed_lease_token
    and completed_version < claimed_version
    and claimed_version <= requested_version;

  if not found then
    raise exception 'Projeção % não pode ser concluída com o lease %.',
      claimed_version, claimed_lease_token;
  end if;
end;
$$;

create or replace function public.fail_catalog_sheet_projection(
  claimed_lease_token uuid,
  failure_message text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(btrim(failure_message), '') = '' then
    raise exception 'Falha de projeção inválida: "%"; esperada mensagem não vazia.',
      coalesce(failure_message, 'nulo');
  end if;

  update public.catalog_sheet_projection_state
  set
    lease_token = null,
    lease_expires_at = null,
    last_error = left(regexp_replace(failure_message, E'[\\r\\n\\t]+', ' ', 'g'), 1000)
  where singleton and lease_token = claimed_lease_token;

  if not found then
    raise exception 'Projeção não pode registrar falha com o lease %.', claimed_lease_token;
  end if;
end;
$$;

create or replace function public.get_catalog_sheet_projection()
returns table (
  product_id bigint,
  variant_id bigint,
  sku text,
  product_name text,
  variant_label text,
  category_name text,
  availability text,
  price numeric,
  pix_price numeric,
  stock integer,
  product_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    product.nuvemshop_product_id as product_id,
    variant.nuvemshop_variant_id as variant_id,
    variant.sku,
    product.name as product_name,
    variant.label as variant_label,
    coalesce(category.name, 'Sem categoria') as category_name,
    case
      when product.status = 'active'
        and variant.is_available
        and variant.stock > 0
      then 'Em estoque'
      else 'Sem estoque'
    end as availability,
    variant.price_cents / 100.0 as price,
    case
      when variant.pix_price_cents is null then null
      else variant.pix_price_cents / 100.0
    end as pix_price,
    variant.stock,
    product.source_url as product_url
  from public.products as product
  join public.product_variants as variant on variant.product_id = product.id
  left join public.categories as category on category.id = product.category_id
  order by variant.nuvemshop_variant_id;
$$;

revoke all on function public.request_catalog_sheet_projection()
  from public, anon, authenticated;
revoke all on function public.enqueue_catalog_sheet_projection()
  from public, anon, authenticated;
revoke all on function public.claim_catalog_sheet_projection()
  from public, anon, authenticated;
revoke all on function public.complete_catalog_sheet_projection(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.fail_catalog_sheet_projection(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_catalog_sheet_projection()
  from public, anon, authenticated;

grant execute on function public.claim_catalog_sheet_projection() to service_role;
grant execute on function public.complete_catalog_sheet_projection(uuid, bigint)
  to service_role;
grant execute on function public.fail_catalog_sheet_projection(uuid, text)
  to service_role;
grant execute on function public.get_catalog_sheet_projection() to service_role;

comment on table public.catalog_sheet_projection_state is
  'Durable state for the Supabase-to-Google-Sheets catalog projection.';
comment on function public.get_catalog_sheet_projection() is
  'Returns the managed Produtos projection keyed by immutable external IDs; it never includes column K.';
