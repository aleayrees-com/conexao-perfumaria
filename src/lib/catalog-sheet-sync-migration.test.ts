import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationUrl = new URL(
  '../../supabase/migrations/20260723110000_catalog_supabase_source_of_truth.sql',
  import.meta.url,
);
const migrationPath = fileURLToPath(migrationUrl);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, 'utf8')
  : '';

describe('catalog Supabase source-of-truth migration', () => {
  test('disables the reverse Google Sheets synchronization', () => {
    expect(migrationSql).toContain(
      'select public.unschedule_inventory_sync_cron();',
    );
    expect(migrationSql).toContain(
      'revoke all on function public.sync_catalog_from_google_sheet(boolean)',
    );
    expect(migrationSql).not.toContain('cron.schedule(');
  });

  test('records pending catalog projections with a versioned lease', () => {
    expect(migrationSql).toContain(
      'create table public.catalog_sheet_projection_state',
    );
    expect(migrationSql).toContain('requested_version bigint not null default 1');
    expect(migrationSql).toContain('lease_token uuid');
    expect(migrationSql).toContain(
      'create or replace function public.claim_catalog_sheet_projection()',
    );
    expect(migrationSql).toContain(
      'create or replace function public.complete_catalog_sheet_projection(',
    );
  });

  test('projects catalog rows through immutable external variant IDs', () => {
    expect(migrationSql).toContain(
      'create or replace function public.get_catalog_sheet_projection()',
    );
    expect(migrationSql).toContain('variant.nuvemshop_variant_id');
    expect(migrationSql).toContain("'Sem categoria'");
    expect(migrationSql).toContain("'Em estoque'");
  });
});
