create table if not exists public.catalog_card_pricing_settings (
  id boolean primary key default true check (id),
  card_fee_basis_points integer not null default 701
    check (card_fee_basis_points between 0 and 9999),
  card_installment_count integer not null default 3
    check (card_installment_count > 0)
);

insert into public.catalog_card_pricing_settings (
  id,
  card_fee_basis_points,
  card_installment_count
)
values (true, 701, 3)
on conflict (id) do nothing;

alter table public.catalog_card_pricing_settings enable row level security;
revoke all on public.catalog_card_pricing_settings from public, anon, authenticated;
grant select, update on public.catalog_card_pricing_settings to service_role;

create or replace function public.validate_catalog_card_price_input(
  pix_price_cents integer,
  card_fee_basis_points integer
)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if pix_price_cents is null or pix_price_cents < 0 then
    raise exception 'Preço PIX "%" inválido; esperado inteiro não negativo.', pix_price_cents;
  end if;

  if card_fee_basis_points is null
    or card_fee_basis_points < 0
    or card_fee_basis_points >= 10000 then
    raise exception 'Taxa "%" inválida; esperado inteiro entre 0 e 9999 pontos-base.', card_fee_basis_points;
  end if;
end;
$$;

create or replace function public.calculate_catalog_card_price_cents(
  pix_price_cents integer,
  card_fee_basis_points integer
)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  calculated_card_price_cents numeric;
begin
  perform public.validate_catalog_card_price_input(
    pix_price_cents,
    card_fee_basis_points
  );

  calculated_card_price_cents := ceil(pix_price_cents * 10000::numeric / (10000 - card_fee_basis_points));

  if calculated_card_price_cents > 2147483647 then
    raise exception 'Preço calculado "%" inválido; esperado até 2147483647 centavos.', calculated_card_price_cents;
  end if;

  return calculated_card_price_cents::integer;
end;
$$;

revoke all on function public.validate_catalog_card_price_input(integer, integer)
  from public, anon, authenticated;
revoke all on function public.calculate_catalog_card_price_cents(integer, integer)
  from public, anon, authenticated;
grant execute on function public.validate_catalog_card_price_input(integer, integer)
  to service_role;
grant execute on function public.calculate_catalog_card_price_cents(integer, integer)
  to service_role;

comment on function public.calculate_catalog_card_price_cents(integer, integer) is
  'Grosses up a PIX price so the merchant receives the same net value after a card fee.';

create or replace function public.sync_catalog_from_google_sheet(
  dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  card_fee_basis_points integer;
  card_installment_count integer;
  changes_json jsonb;
  csv_fields text[];
  csv_line text;
  csv_lines text[];
  duplicate_resolved_id bigint;
  duplicate_sheet_id bigint;
  error_message text;
  fallback_count integer;
  header text;
  pix_price_cents integer;
  pix_price_text text;
  price_cents integer;
  product_slug text;
  product_url text;
  response_content text;
  response_content_type text;
  response_status integer;
  row_index integer;
  run_id uuid;
  sheet_url constant text :=
    'https://docs.google.com/spreadsheets/d/1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/gviz/tq?tqx=out:csv&gid=257370644&tq=select%20B%2CI%2CJ%2CL';
  stock_text text;
  sync_changed_count integer;
  sync_scanned_count integer;
  unresolved_variant_id bigint;
  variant_id_text text;
begin
  insert into public.inventory_sync_runs (mode, status, metadata)
  values (
    case when dry_run then 'dry_run' else 'live' end,
    'running',
    jsonb_build_object(
      'source', 'google_sheets_postgres_http',
      'spreadsheetId', '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4',
      'sheetId', 257370644,
      'fields', jsonb_build_array('pixPrice', 'stock'),
      'matchStrategy', 'variant_id_then_product_slug'
    )
  )
  returning id into run_id;

  begin
    select
      settings.card_fee_basis_points,
      settings.card_installment_count
    into
      card_fee_basis_points,
      card_installment_count
    from public.catalog_card_pricing_settings as settings
    where settings.id;

    if card_fee_basis_points is null or card_installment_count is null then
      raise exception 'Configuração de cartão ausente; esperado taxa e parcelas para recebimento em 1 dia útil.';
    end if;

    update public.inventory_sync_runs
    set metadata = metadata || jsonb_build_object(
      'cardFeeBasisPoints', card_fee_basis_points,
      'cardInstallmentCount', card_installment_count
    )
    where id = run_id;

    select response.status, response.content_type, response.content
    into response_status, response_content_type, response_content
    from extensions.http_get(sheet_url) as response;

    if response_status <> 200 then
      raise exception 'Google Sheets respondeu com HTTP %; esperado HTTP 200.', response_status;
    end if;

    if position('text/csv' in lower(coalesce(response_content_type, ''))) = 0 then
      raise exception 'Google Sheets retornou Content-Type "%"; esperado text/csv.',
        coalesce(response_content_type, 'ausente');
    end if;

    csv_lines := regexp_split_to_array(response_content, E'\\r?\\n');
    header := replace(btrim(csv_lines[1]), chr(65279), '');

    if header <> '"ID Variação","Preço PIX","Unidades na loja","Link do produto"' then
      raise exception 'Cabeçalho "%" inválido; esperado ID, Preço PIX, estoque e link.', header;
    end if;

    create temporary table catalog_sheet_input (
      sheet_variant_id bigint primary key,
      price_cents integer not null,
      pix_price_cents integer not null,
      stock integer not null,
      product_slug text not null
    ) on commit drop;

    for row_index in 2..cardinality(csv_lines)
    loop
      csv_line := btrim(csv_lines[row_index]);
      continue when csv_line = '';
      csv_fields := regexp_match(
        csv_line,
        '^"([0-9]+)","([^"]*)","([0-9]+)","([^"]+)"$'
      );

      if csv_fields is null then
        raise exception 'Linha % inválida: "%"; esperadas quatro colunas CSV entre aspas.',
          row_index, left(csv_line, 200);
      end if;

      variant_id_text := csv_fields[1];
      pix_price_text := csv_fields[2];
      stock_text := csv_fields[3];
      product_url := csv_fields[4];
      product_slug := lower(substring(product_url from '/produtos/([^/?#]+)'));

      if variant_id_text::numeric <= 0
        or variant_id_text::numeric > 9007199254740991 then
        raise exception 'ID Variação "%" inválido na linha %; esperado inteiro positivo seguro.',
          variant_id_text, row_index;
      end if;

      if stock_text::numeric > 2147483647 then
        raise exception 'Estoque "%" inválido na linha %; esperado inteiro não negativo de 32 bits.',
          stock_text, row_index;
      end if;

      if product_slug is null or btrim(product_slug) = '' then
        raise exception 'Link "%" inválido na linha %; esperado /produtos/<slug>.',
          product_url, row_index;
      end if;

      pix_price_cents := public.parse_catalog_sheet_money_cents(
        pix_price_text,
        'Preço PIX',
        row_index
      );
      price_cents := public.calculate_catalog_card_price_cents(
        pix_price_cents,
        card_fee_basis_points
      );

      insert into pg_temp.catalog_sheet_input (
        sheet_variant_id,
        price_cents,
        pix_price_cents,
        stock,
        product_slug
      )
      values (
        variant_id_text::bigint,
        price_cents,
        pix_price_cents,
        stock_text::integer,
        product_slug
      );
    end loop;

    select incoming.sheet_variant_id
    into duplicate_sheet_id
    from pg_temp.catalog_sheet_input as incoming
    group by incoming.sheet_variant_id
    having count(*) > 1
    limit 1;

    if duplicate_sheet_id is not null then
      raise exception 'ID Variação "%" duplicado; esperado um ID único por linha.', duplicate_sheet_id;
    end if;

    create temporary table catalog_sheet_resolved on commit drop as
    select
      incoming.*,
      coalesce(
        direct_variant.nuvemshop_variant_id,
        case when fallback_match.variant_count = 1
          then fallback_match.nuvemshop_variant_id
        end
      ) as resolved_variant_id,
      direct_variant.nuvemshop_variant_id is null
        and fallback_match.variant_count = 1 as used_fallback
    from pg_temp.catalog_sheet_input as incoming
    left join public.product_variants as direct_variant
      on direct_variant.nuvemshop_variant_id = incoming.sheet_variant_id
    left join lateral (
      select
        count(*)::integer as variant_count,
        min(variant.nuvemshop_variant_id) as nuvemshop_variant_id
      from public.products as product
      join public.product_variants as variant on variant.product_id = product.id
      where product.slug = incoming.product_slug
    ) as fallback_match on true;

    select resolved.sheet_variant_id
    into unresolved_variant_id
    from pg_temp.catalog_sheet_resolved as resolved
    where resolved.resolved_variant_id is null
    limit 1;

    if unresolved_variant_id is not null then
      raise exception 'ID Variação "%" sem correspondência; esperado ID ou link único no Supabase.',
        unresolved_variant_id;
    end if;

    select resolved.resolved_variant_id
    into duplicate_resolved_id
    from pg_temp.catalog_sheet_resolved as resolved
    group by resolved.resolved_variant_id
    having count(*) > 1
    limit 1;

    if duplicate_resolved_id is not null then
      raise exception 'ID Variação resolvido "%" duplicado; esperado destino único.', duplicate_resolved_id;
    end if;

    create temporary table catalog_sheet_changes on commit drop as
    select
      variant.nuvemshop_variant_id,
      variant.product_id,
      variant.price_cents as current_price_cents,
      resolved.price_cents as new_price_cents,
      variant.pix_price_cents as current_pix_price_cents,
      resolved.pix_price_cents as new_pix_price_cents,
      variant.stock as current_stock,
      resolved.stock as new_stock
    from pg_temp.catalog_sheet_resolved as resolved
    join public.product_variants as variant
      on variant.nuvemshop_variant_id = resolved.resolved_variant_id
    where (variant.price_cents, variant.pix_price_cents, variant.stock, variant.is_available)
      is distinct from (
        resolved.price_cents,
        resolved.pix_price_cents,
        resolved.stock,
        resolved.stock > 0
      );

    select count(*)::integer into sync_scanned_count
    from pg_temp.catalog_sheet_resolved;
    select count(*)::integer into sync_changed_count
    from pg_temp.catalog_sheet_changes;
    select count(*) filter (where resolved.used_fallback)::integer into fallback_count
    from pg_temp.catalog_sheet_resolved as resolved;
    select coalesce(jsonb_agg(to_jsonb(change)), '[]'::jsonb) into changes_json
    from pg_temp.catalog_sheet_changes as change;

    if not dry_run then
      update public.product_variants as variant
      set
        price_cents = incoming.price_cents,
        pix_price_cents = incoming.pix_price_cents,
        stock = incoming.stock,
        is_available = incoming.stock > 0
      from pg_temp.catalog_sheet_resolved as incoming
      where variant.nuvemshop_variant_id = incoming.resolved_variant_id
        and (variant.price_cents, variant.pix_price_cents, variant.stock, variant.is_available)
          is distinct from (
            incoming.price_cents,
            incoming.pix_price_cents,
            incoming.stock,
            incoming.stock > 0
          );

      update public.products as product
      set
        price_cents = aggregate.min_price_cents,
        pix_price_cents = aggregate.min_pix_price_cents
      from (
        select
          variant.product_id,
          min(variant.price_cents) as min_price_cents,
          min(variant.pix_price_cents) as min_pix_price_cents
        from public.product_variants as variant
        where variant.product_id in (
          select distinct change.product_id
          from pg_temp.catalog_sheet_changes as change
        )
        group by variant.product_id
      ) as aggregate
      where product.id = aggregate.product_id
        and (product.price_cents, product.pix_price_cents)
          is distinct from (
            aggregate.min_price_cents,
            aggregate.min_pix_price_cents
          );
    end if;

    update public.inventory_sync_runs
    set
      status = 'success',
      scanned_count = sync_scanned_count,
      changed_count = sync_changed_count,
      unchanged_count = sync_scanned_count - sync_changed_count,
      metadata = metadata || jsonb_build_object('fallbackMatched', fallback_count),
      finished_at = now()
    where id = run_id;

    return jsonb_build_object(
      'ok', true,
      'dryRun', dry_run,
      'runId', run_id,
      'scanned', sync_scanned_count,
      'changed', sync_changed_count,
      'unchanged', sync_scanned_count - sync_changed_count,
      'fallbackMatched', fallback_count,
      'changes', changes_json
    );
  exception
    when others then
      get stacked diagnostics error_message = message_text;
      error_message := left(regexp_replace(error_message, E'[\\r\\n\\t]+', ' ', 'g'), 1000);

      update public.inventory_sync_runs
      set status = 'error', error_summary = error_message, finished_at = now()
      where id = run_id;

      return jsonb_build_object(
        'ok', false,
        'dryRun', dry_run,
        'runId', run_id,
        'error', error_message
      );
  end;
end;
$$;

create or replace function public.sync_inventory_from_google_sheet(
  dry_run boolean default false
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.sync_catalog_from_google_sheet(dry_run);
$$;

create or replace function public.unschedule_inventory_sync_cron()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_job record;
  removed boolean := false;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in ('sync-inventory-every-5-minutes', 'sync-catalog-every-hour')
  loop
    perform cron.unschedule(existing_job.jobid);
    removed := true;
  end loop;

  return removed;
end;
$$;

create or replace function public.schedule_inventory_sync_cron()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id bigint;
begin
  perform public.unschedule_inventory_sync_cron();

  select cron.schedule(
    'sync-catalog-every-hour',
    '0 * * * *',
    $cron$select public.sync_catalog_from_google_sheet(false);$cron$
  )
  into job_id;

  return job_id;
end;
$$;

revoke all on function public.sync_catalog_from_google_sheet(boolean)
  from public, anon, authenticated;
revoke all on function public.sync_inventory_from_google_sheet(boolean)
  from public, anon, authenticated;
revoke all on function public.unschedule_inventory_sync_cron()
  from public, anon, authenticated;
revoke all on function public.schedule_inventory_sync_cron()
  from public, anon, authenticated;
grant execute on function public.sync_catalog_from_google_sheet(boolean)
  to service_role;
grant execute on function public.sync_inventory_from_google_sheet(boolean)
  to service_role;

comment on function public.sync_catalog_from_google_sheet(boolean) is
  'Synchronizes variant stock and PIX price from Google Sheets, deriving the card price centrally.';

select public.schedule_inventory_sync_cron();
