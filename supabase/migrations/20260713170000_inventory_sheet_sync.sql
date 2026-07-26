create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.inventory_sync_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  mode text not null,
  status text not null default 'running',
  scanned_count integer not null default 0,
  changed_count integer not null default 0,
  unchanged_count integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  constraint inventory_sync_runs_mode_valid check (mode in ('dry_run', 'live')),
  constraint inventory_sync_runs_status_valid check (status in ('running', 'success', 'error')),
  constraint inventory_sync_runs_scanned_count_non_negative check (scanned_count >= 0),
  constraint inventory_sync_runs_changed_count_non_negative check (changed_count >= 0),
  constraint inventory_sync_runs_unchanged_count_non_negative check (unchanged_count >= 0),
  constraint inventory_sync_runs_error_summary_not_blank check (
    error_summary is null or btrim(error_summary) <> ''
  ),
  constraint inventory_sync_runs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists inventory_sync_runs_started_at_idx
  on public.inventory_sync_runs (started_at desc);

alter table public.inventory_sync_runs enable row level security;

revoke all on public.inventory_sync_runs from anon, authenticated;
grant select, insert, update on public.inventory_sync_runs to service_role;

create or replace function public.sync_inventory_snapshot(
  inventory_rows jsonb,
  dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_count integer;
  changes_json jsonb;
  duplicate_variant_id bigint;
  lock_acquired boolean;
  scanned_count integer;
  unknown_variant_id bigint;
begin
  if inventory_rows is null or jsonb_typeof(inventory_rows) <> 'array' then
    raise exception 'Payload de estoque deve ser um array JSON.';
  end if;

  select pg_try_advisory_xact_lock(hashtextextended('inventory-sheet-sync', 0))
  into lock_acquired;

  if not lock_acquired then
    raise exception 'Já existe uma sincronização de estoque em andamento.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(inventory_rows) as elements(item)
    where jsonb_typeof(item) <> 'object'
      or not item ? 'nuvemshopVariantId'
      or not item ? 'stock'
      or item ->> 'nuvemshopVariantId' !~ '^[0-9]+$'
      or item ->> 'stock' !~ '^[0-9]+$'
      or (item ->> 'nuvemshopVariantId')::numeric <= 0
      or (item ->> 'nuvemshopVariantId')::numeric > 9007199254740991
      or (item ->> 'stock')::numeric > 2147483647
  ) then
    raise exception 'Payload de estoque contém valores inválidos.';
  end if;

  create temporary table inventory_sync_input (
    nuvemshop_variant_id bigint not null,
    stock integer not null
  ) on commit drop;

  insert into pg_temp.inventory_sync_input (nuvemshop_variant_id, stock)
  select
    (item ->> 'nuvemshopVariantId')::bigint,
    (item ->> 'stock')::integer
  from jsonb_array_elements(inventory_rows) as elements(item);

  select count(*)::integer
  into scanned_count
  from pg_temp.inventory_sync_input;

  if scanned_count = 0 then
    raise exception 'Snapshot de estoque vazio.';
  end if;

  select input.nuvemshop_variant_id
  into duplicate_variant_id
  from pg_temp.inventory_sync_input as input
  group by input.nuvemshop_variant_id
  having count(*) > 1
  order by input.nuvemshop_variant_id
  limit 1;

  if duplicate_variant_id is not null then
    raise exception 'ID Variação duplicado: %.', duplicate_variant_id;
  end if;

  select input.nuvemshop_variant_id
  into unknown_variant_id
  from pg_temp.inventory_sync_input as input
  left join public.product_variants as variant
    on variant.nuvemshop_variant_id = input.nuvemshop_variant_id
  where variant.id is null
  order by input.nuvemshop_variant_id
  limit 1;

  if unknown_variant_id is not null then
    raise exception 'ID Variação não encontrado no Supabase: %.', unknown_variant_id;
  end if;

  create temporary table inventory_sync_changes (
    nuvemshop_variant_id bigint primary key,
    product_id uuid not null,
    current_stock integer not null,
    new_stock integer not null
  ) on commit drop;

  insert into pg_temp.inventory_sync_changes (
    nuvemshop_variant_id,
    product_id,
    current_stock,
    new_stock
  )
  select
    variant.nuvemshop_variant_id,
    variant.product_id,
    variant.stock,
    incoming.stock
  from pg_temp.inventory_sync_input as incoming
  join public.product_variants as variant
    on variant.nuvemshop_variant_id = incoming.nuvemshop_variant_id
  where (variant.stock, variant.is_available)
    is distinct from (incoming.stock, incoming.stock > 0);

  select count(*)::integer
  into changed_count
  from pg_temp.inventory_sync_changes;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nuvemshopVariantId', change.nuvemshop_variant_id,
        'currentStock', change.current_stock,
        'newStock', change.new_stock
      )
      order by change.nuvemshop_variant_id
    ),
    '[]'::jsonb
  )
  into changes_json
  from pg_temp.inventory_sync_changes as change;

  if not dry_run then
    update public.product_variants as variant
    set
      stock = incoming.stock,
      is_available = incoming.stock > 0
    from pg_temp.inventory_sync_input as incoming
    where variant.nuvemshop_variant_id = incoming.nuvemshop_variant_id
      and (variant.stock, variant.is_available)
        is distinct from (incoming.stock, incoming.stock > 0);
  end if;

  return jsonb_build_object(
    'scanned', scanned_count,
    'changed', changed_count,
    'unchanged', scanned_count - changed_count,
    'changes', changes_json
  );
end;
$$;

revoke all on function public.sync_inventory_snapshot(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_inventory_snapshot(jsonb, boolean) to service_role;

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
    where jobname = 'sync-inventory-every-5-minutes'
  loop
    perform cron.unschedule(existing_job.jobid);
    removed := true;
  end loop;

  return removed;
end;
$$;

revoke all on function public.unschedule_inventory_sync_cron() from public, anon, authenticated;
grant execute on function public.unschedule_inventory_sync_cron() to service_role;

create or replace function public.schedule_inventory_sync_cron()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id bigint;
  project_url text;
  service_role_key text;
begin
  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'inventory_sync_project_url'
  limit 1;

  select decrypted_secret
  into service_role_key
  from vault.decrypted_secrets
  where name = 'inventory_sync_service_role_key'
  limit 1;

  if project_url is null or btrim(project_url) = '' then
    raise exception 'Secret inventory_sync_project_url ausente no Vault.';
  end if;

  if service_role_key is null or btrim(service_role_key) = '' then
    raise exception 'Secret inventory_sync_service_role_key ausente no Vault.';
  end if;

  perform public.unschedule_inventory_sync_cron();

  select cron.schedule(
    'sync-inventory-every-5-minutes',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := rtrim(
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'inventory_sync_project_url'
            limit 1
          ),
          '/'
        ) || '/functions/v1/sync-inventory',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'inventory_sync_service_role_key'
            limit 1
          ),
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'inventory_sync_service_role_key'
            limit 1
          )
        ),
        body := jsonb_build_object('dryRun', false),
        timeout_milliseconds := 30000
      ) as request_id;
    $cron$
  )
  into job_id;

  return job_id;
end;
$$;

revoke all on function public.schedule_inventory_sync_cron() from public, anon, authenticated;
grant execute on function public.schedule_inventory_sync_cron() to service_role;

comment on table public.inventory_sync_runs is
  'Execution history for Google Sheets inventory synchronization.';

comment on function public.sync_inventory_snapshot(jsonb, boolean) is
  'Atomically validates and applies a Google Sheets variant inventory snapshot.';
