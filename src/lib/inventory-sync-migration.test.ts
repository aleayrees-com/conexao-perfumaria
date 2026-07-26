import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../supabase/migrations/20260713170000_inventory_sheet_sync.sql',
  import.meta.url,
);

describe('inventory sheet sync migration', () => {
  let sql: string;

  beforeAll(async () => {
    sql = await readFile(migrationUrl, 'utf8');
  });

  it('creates a private execution log with constrained states', () => {
    expect(sql).toContain(
      'create table if not exists public.inventory_sync_runs',
    );
    expect(sql).toContain("mode in ('dry_run', 'live')");
    expect(sql).toContain("status in ('running', 'success', 'error')");
    expect(sql).toContain('scanned_count >= 0');
    expect(sql).toContain('changed_count >= 0');
    expect(sql).toContain('unchanged_count >= 0');
    expect(sql).toContain(
      'alter table public.inventory_sync_runs enable row level security',
    );
    expect(sql).toContain(
      'revoke all on public.inventory_sync_runs from anon, authenticated',
    );
    expect(sql).toContain(
      'grant select, insert, update on public.inventory_sync_runs to service_role',
    );
  });

  it('defines an atomic, locked, service-role-only snapshot RPC', () => {
    expect(sql).toContain(
      'create or replace function public.sync_inventory_snapshot(',
    );
    expect(sql).toContain(
      "pg_try_advisory_xact_lock(hashtextextended('inventory-sheet-sync', 0))",
    );
    expect(sql).toContain("jsonb_typeof(inventory_rows) <> 'array'");
    expect(sql).toContain('create temporary table inventory_sync_input');
    expect(sql).toContain('ID Variação duplicado');
    expect(sql).toContain('ID Variação não encontrado no Supabase');
    expect(sql).toContain(
      'revoke all on function public.sync_inventory_snapshot(jsonb, boolean) from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.sync_inventory_snapshot(jsonb, boolean) to service_role',
    );
  });

  it('updates only stock differences and reports dry-run changes', () => {
    expect(sql).toContain('create temporary table inventory_sync_changes');
    expect(sql).toContain(
      'is distinct from (incoming.stock, incoming.stock > 0)',
    );
    expect(sql).toContain('if not dry_run then');
    expect(sql).toContain('update public.product_variants as variant');
    expect(sql).toContain('is_available = incoming.stock > 0');
    expect(sql).toContain("'scanned', scanned_count");
    expect(sql).toContain("'changed', changed_count");
    expect(sql).toContain("'unchanged', scanned_count - changed_count");
    expect(sql).toContain("'changes', changes_json");
  });

  it('defines a five-minute Cron backed by Vault and pg_net', () => {
    expect(sql).toContain('create extension if not exists pg_cron');
    expect(sql).toContain('create extension if not exists pg_net');
    expect(sql).toContain('create extension if not exists supabase_vault');
    expect(sql).toContain(
      'create or replace function public.schedule_inventory_sync_cron()',
    );
    expect(sql).toContain(
      'create or replace function public.unschedule_inventory_sync_cron()',
    );
    expect(sql).toContain("'sync-inventory-every-5-minutes'");
    expect(sql).toContain("'*/5 * * * *'");
    expect(sql).toContain('vault.decrypted_secrets');
    expect(sql).toContain("'/functions/v1/sync-inventory'");
    expect(sql).toContain("jsonb_build_object('dryRun', false)");
  });
});
