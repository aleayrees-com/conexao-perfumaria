create or replace function public.sync_inventory_from_google_sheet(
  dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  csv_fields text[];
  csv_lines text[];
  csv_line text;
  duplicate_resolved_id bigint;
  duplicate_sheet_id bigint;
  error_message text;
  fallback_count integer;
  header text;
  product_slug text;
  product_url text;
  response_content text;
  response_content_type text;
  response_status integer;
  row_index integer;
  run_id uuid;
  sheet_url constant text :=
    'https://docs.google.com/spreadsheets/d/1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/gviz/tq?tqx=out:csv&gid=257370644&tq=select%20B%2CJ%2CL';
  snapshot jsonb;
  stock_text text;
  summary jsonb;
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
      'matchStrategy', 'variant_id_then_product_slug'
    )
  )
  returning id into run_id;

  begin
    select response.status, response.content_type, response.content
    into response_status, response_content_type, response_content
    from extensions.http_get(sheet_url) as response;

    if response_status <> 200 then
      raise exception 'Google Sheets respondeu com HTTP %.', response_status;
    end if;

    if position('text/csv' in lower(coalesce(response_content_type, ''))) = 0 then
      raise exception 'Google Sheets retornou Content-Type inesperado: %.',
        coalesce(response_content_type, 'ausente');
    end if;

    if response_content is null or btrim(response_content) = '' then
      raise exception 'Google Sheets retornou um CSV vazio.';
    end if;

    csv_lines := regexp_split_to_array(response_content, E'\\r?\\n');

    if coalesce(cardinality(csv_lines), 0) < 2 then
      raise exception 'CSV de estoque não contém linhas de produtos.';
    end if;

    header := replace(btrim(csv_lines[1]), chr(65279), '');

    if header <> '"ID Variação","Unidades na loja","Link do produto"' then
      raise exception 'Cabeçalho inesperado no CSV de estoque: %.', header;
    end if;

    create temporary table inventory_sheet_input (
      sheet_variant_id bigint not null,
      stock integer not null,
      product_slug text not null
    ) on commit drop;

    for row_index in 2..cardinality(csv_lines)
    loop
      csv_line := btrim(csv_lines[row_index]);

      continue when csv_line = '';

      csv_fields := string_to_array(csv_line, ',');

      if cardinality(csv_fields) <> 3 then
        raise exception 'Linha % do CSV não possui exatamente três colunas.', row_index;
      end if;

      variant_id_text := trim(both '"' from btrim(csv_fields[1]));
      stock_text := trim(both '"' from btrim(csv_fields[2]));
      product_url := trim(both '"' from btrim(csv_fields[3]));
      product_slug := lower(substring(product_url from '/produtos/([^/?#]+)'));

      if variant_id_text !~ '^[0-9]+$'
        or variant_id_text::numeric <= 0
        or variant_id_text::numeric > 9007199254740991
      then
        raise exception 'ID Variação inválido na linha %.', row_index;
      end if;

      if stock_text !~ '^[0-9]+$'
        or stock_text::numeric > 2147483647
      then
        raise exception 'Estoque inválido na linha %.', row_index;
      end if;

      if product_slug is null or btrim(product_slug) = '' then
        raise exception 'Link do produto inválido na linha %.', row_index;
      end if;

      insert into pg_temp.inventory_sheet_input (
        sheet_variant_id,
        stock,
        product_slug
      )
      values (
        variant_id_text::bigint,
        stock_text::integer,
        product_slug
      );
    end loop;

    if not exists (select 1 from pg_temp.inventory_sheet_input) then
      raise exception 'Snapshot de estoque vazio.';
    end if;

    select incoming.sheet_variant_id
    into duplicate_sheet_id
    from pg_temp.inventory_sheet_input as incoming
    group by incoming.sheet_variant_id
    having count(*) > 1
    order by incoming.sheet_variant_id
    limit 1;

    if duplicate_sheet_id is not null then
      raise exception 'ID Variação duplicado na planilha: %.', duplicate_sheet_id;
    end if;

    create temporary table inventory_sheet_resolved (
      sheet_variant_id bigint not null,
      resolved_variant_id bigint,
      stock integer not null,
      used_fallback boolean not null
    ) on commit drop;

    insert into pg_temp.inventory_sheet_resolved (
      sheet_variant_id,
      resolved_variant_id,
      stock,
      used_fallback
    )
    select
      incoming.sheet_variant_id,
      coalesce(
        direct_variant.nuvemshop_variant_id,
        case
          when fallback_match.variant_count = 1
            then fallback_match.nuvemshop_variant_id
          else null
        end
      ),
      incoming.stock,
      direct_variant.nuvemshop_variant_id is null
        and fallback_match.variant_count = 1
    from pg_temp.inventory_sheet_input as incoming
    left join public.product_variants as direct_variant
      on direct_variant.nuvemshop_variant_id = incoming.sheet_variant_id
    left join lateral (
      select
        count(*)::integer as variant_count,
        min(variant.nuvemshop_variant_id) as nuvemshop_variant_id
      from public.products as product
      join public.product_variants as variant
        on variant.product_id = product.id
      where product.slug = incoming.product_slug
    ) as fallback_match on true;

    select resolved.sheet_variant_id
    into unresolved_variant_id
    from pg_temp.inventory_sheet_resolved as resolved
    where resolved.resolved_variant_id is null
    order by resolved.sheet_variant_id
    limit 1;

    if unresolved_variant_id is not null then
      raise exception 'ID Variação sem correspondência segura no Supabase: %.',
        unresolved_variant_id;
    end if;

    select resolved.resolved_variant_id
    into duplicate_resolved_id
    from pg_temp.inventory_sheet_resolved as resolved
    group by resolved.resolved_variant_id
    having count(*) > 1
    order by resolved.resolved_variant_id
    limit 1;

    if duplicate_resolved_id is not null then
      raise exception 'ID Variação resolvido em duplicidade: %.', duplicate_resolved_id;
    end if;

    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'nuvemshopVariantId', resolved.resolved_variant_id,
            'stock', resolved.stock
          )
          order by resolved.resolved_variant_id
        ),
        '[]'::jsonb
      ),
      count(*) filter (where resolved.used_fallback)::integer
    into snapshot, fallback_count
    from pg_temp.inventory_sheet_resolved as resolved;

    summary := public.sync_inventory_snapshot(snapshot, dry_run);

    update public.inventory_sync_runs
    set
      status = 'success',
      scanned_count = (summary ->> 'scanned')::integer,
      changed_count = (summary ->> 'changed')::integer,
      unchanged_count = (summary ->> 'unchanged')::integer,
      metadata = metadata || jsonb_build_object(
        'fallbackMatched', fallback_count
      ),
      finished_at = now()
    where id = run_id;

    return jsonb_build_object(
      'ok', true,
      'dryRun', dry_run,
      'runId', run_id,
      'fallbackMatched', fallback_count
    ) || summary;
  exception
    when others then
      get stacked diagnostics error_message = message_text;
      error_message := left(
        regexp_replace(
          coalesce(error_message, 'Erro desconhecido.'),
          E'[\\r\\n\\t]+',
          ' ',
          'g'
        ),
        1000
      );

      update public.inventory_sync_runs
      set
        status = 'error',
        error_summary = error_message,
        finished_at = now()
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

revoke all on function public.sync_inventory_from_google_sheet(boolean) from public, anon, authenticated;
grant execute on function public.sync_inventory_from_google_sheet(boolean) to service_role;

comment on function public.sync_inventory_from_google_sheet(boolean) is
  'Synchronizes the fixed Google Sheet by variant ID, with a single-variant product-slug fallback.';
