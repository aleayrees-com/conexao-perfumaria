import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../supabase/migrations/20260713190000_inventory_sheet_postgres_cron.sql',
  import.meta.url,
);

describe('inventory PostgreSQL Cron migration', () => {
  let sql: string;

  beforeAll(async () => {
    sql = await readFile(migrationUrl, 'utf8');
  });

  it('fetches only the inventory columns from the fixed Google Sheet', () => {
    expect(sql).toContain('create extension if not exists http');
    expect(sql).toContain(
      'create or replace function public.sync_inventory_from_google_sheet(',
    );
    expect(sql).toContain('extensions.http_get');
    expect(sql).toContain(
      '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/gviz/tq',
    );
    expect(sql).toContain('gid=257370644');
    expect(sql).toContain('tq=select%20B%2CJ');
    expect(sql).toContain('response_status <> 200');
    expect(sql).toContain("position('text/csv' in lower(coalesce(response_content_type");
  });

  it('validates and parses the two-column CSV before calling the atomic RPC', () => {
    expect(sql).toContain(`'"ID Variação","Unidades na loja"'`);
    expect(sql).toContain('regexp_split_to_array(response_content');
    expect(sql).toContain("variant_id_text !~ '^[0-9]+$'");
    expect(sql).toContain("stock_text !~ '^[0-9]+$'");
    expect(sql).toContain('public.sync_inventory_snapshot(snapshot, dry_run)');
  });

  it('records successful and failed executions without exposing the function', () => {
    expect(sql).toContain('insert into public.inventory_sync_runs');
    expect(sql).toContain("status = 'success'");
    expect(sql).toContain("status = 'error'");
    expect(sql).toContain('get stacked diagnostics error_message = message_text');
    expect(sql).toContain(
      'revoke all on function public.sync_inventory_from_google_sheet(boolean) from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.sync_inventory_from_google_sheet(boolean) to service_role',
    );
  });

  it('replaces the Edge Function schedule with a direct five-minute SQL job', () => {
    expect(sql).toContain(
      'create or replace function public.schedule_inventory_sync_cron()',
    );
    expect(sql).toContain("'sync-inventory-every-5-minutes'");
    expect(sql).toContain("'*/5 * * * *'");
    expect(sql).toContain('public.sync_inventory_from_google_sheet(false)');
    expect(sql).not.toContain('/functions/v1/sync-inventory');
    expect(sql).not.toContain('vault.decrypted_secrets');
  });
});
