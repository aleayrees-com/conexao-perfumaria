create extension if not exists http with schema extensions;

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
  error_message text;
  header text;
  response_content text;
  response_content_type text;
  response_status integer;
  row_index integer;
  run_id uuid;
  sheet_url constant text :=
    'https://docs.google.com/spreadsheets/d/1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/gviz/tq?tqx=out:csv&gid=257370644&tq=select%20B%2CJ';
  snapshot jsonb := '[]'::jsonb;
  stock_text text;
  summary jsonb;
  variant_id_text text;
begin
  insert into public.inventory_sync_runs (mode, status, metadata)
  values (
    case when dry_run then 'dry_run' else 'live' end,
    'running',
    jsonb_build_object(
      'source', 'google_sheets_postgres_http',
      'spreadsheetId', '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4',
      'sheetId', 257370644
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

    if header <> '"ID Variação","Unidades na loja"' then
      raise exception 'Cabeçalho inesperado no CSV de estoque: %.', header;
    end if;

    for row_index in 2..cardinality(csv_lines)
    loop
      csv_line := btrim(csv_lines[row_index]);

      continue when csv_line = '';

      csv_fields := string_to_array(csv_line, ',');

      if cardinality(csv_fields) <> 2 then
        raise exception 'Linha % do CSV não possui exatamente duas colunas.', row_index;
      end if;

      variant_id_text := trim(both '"' from btrim(csv_fields[1]));
      stock_text := trim(both '"' from btrim(csv_fields[2]));

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

      snapshot := snapshot || jsonb_build_array(
        jsonb_build_object(
          'nuvemshopVariantId', variant_id_text::bigint,
          'stock', stock_text::integer
        )
      );
    end loop;

    if jsonb_array_length(snapshot) = 0 then
      raise exception 'Snapshot de estoque vazio.';
    end if;

    summary := public.sync_inventory_snapshot(snapshot, dry_run);

    update public.inventory_sync_runs
    set
      status = 'success',
      scanned_count = (summary ->> 'scanned')::integer,
      changed_count = (summary ->> 'changed')::integer,
      unchanged_count = (summary ->> 'unchanged')::integer,
      finished_at = now()
    where id = run_id;

    return jsonb_build_object(
      'ok', true,
      'dryRun', dry_run,
      'runId', run_id
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
    'sync-inventory-every-5-minutes',
    '*/5 * * * *',
    $cron$
      select public.sync_inventory_from_google_sheet(false);
    $cron$
  )
  into job_id;

  return job_id;
end;
$$;

revoke all on function public.schedule_inventory_sync_cron() from public, anon, authenticated;
grant execute on function public.schedule_inventory_sync_cron() to service_role;

comment on function public.sync_inventory_from_google_sheet(boolean) is
  'Fetches the fixed Google Sheets inventory CSV and atomically compares or applies its snapshot.';

comment on function public.schedule_inventory_sync_cron() is
  'Schedules direct Google Sheets inventory synchronization every five minutes.';
