import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readMigrationFile(relativePath: string): string {
  const migrationUrl = new URL(relativePath, import.meta.url);
  const migrationPath = fileURLToPath(migrationUrl);

  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
}

const sheetSyncMigrationSql = readMigrationFile(
  '../../supabase/migrations/20260720190000_catalog_sheet_hourly_sync.sql',
);
const cardPricingMigrationSql = readMigrationFile(
  '../../supabase/migrations/20260721120000_derive_card_price_from_pix.sql',
);
const catalogProjectionMigrationSql = readMigrationFile(
  '../../supabase/migrations/20260723110000_catalog_supabase_source_of_truth.sql',
);

describe('catalog sheet sync migration', () => {
  test('reads prices and stock from the configured Produtos sheet', () => {
    expect(sheetSyncMigrationSql).toContain(
      '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4',
    );
    expect(sheetSyncMigrationSql).toContain('gid=257370644');
    expect(sheetSyncMigrationSql).toContain('select%20B%2CH%2CI%2CJ%2CL');
  });

  test('updates variant and product prices together with stock', () => {
    expect(sheetSyncMigrationSql).toContain('price_cents = incoming.price_cents');
    expect(sheetSyncMigrationSql).toContain(
      'pix_price_cents = incoming.pix_price_cents',
    );
    expect(sheetSyncMigrationSql).toContain('price_cents = aggregate.min_price_cents');
    expect(sheetSyncMigrationSql).toContain(
      'pix_price_cents = aggregate.min_pix_price_cents',
    );
    expect(sheetSyncMigrationSql).toContain('stock = incoming.stock');
  });

  test('derives a three-percent PIX discount when the sheet cell is blank', () => {
    expect(sheetSyncMigrationSql).toContain('round(price_cents * 0.97)::integer');
  });

  test('runs hourly and remains callable manually', () => {
    expect(sheetSyncMigrationSql).toContain("'0 * * * *'");
    expect(sheetSyncMigrationSql).toContain(
      'select public.sync_catalog_from_google_sheet(false);',
    );
  });

  test('uses unambiguous run counters when updating sync history', () => {
    expect(sheetSyncMigrationSql).toContain('sync_scanned_count integer;');
    expect(sheetSyncMigrationSql).toContain('scanned_count = sync_scanned_count');
    expect(sheetSyncMigrationSql).not.toContain(
      'sync_catalog_from_google_sheet.scanned_count',
    );
  });
});

describe('automatic card pricing migration', () => {
  test('grosses up PIX with the 1-day InfinitePay rate', () => {
    expect(cardPricingMigrationSql).toContain(
      'card_fee_basis_points integer not null default 701',
    );
    expect(cardPricingMigrationSql).toContain(
      'ceil(pix_price_cents * 10000::numeric / (10000 - card_fee_basis_points))',
    );
  });

  test('uses PIX as the only sheet price source', () => {
    expect(cardPricingMigrationSql).toContain('select%20B%2CI%2CJ%2CL');
    expect(cardPricingMigrationSql).not.toContain('select%20B%2CH%2CI%2CJ%2CL');
    expect(cardPricingMigrationSql).toContain(
      '"ID Variação","Preço PIX","Unidades na loja","Link do produto"',
    );
  });

  test('rejects blank PIX values instead of deriving a three-percent discount', () => {
    expect(cardPricingMigrationSql).toContain("'Preço PIX'");
    expect(cardPricingMigrationSql).not.toContain(
      'round(price_cents * 0.97)::integer',
    );
  });

  test('keeps hourly scheduling and the manual sync entry point', () => {
    expect(cardPricingMigrationSql).toContain("'0 * * * *'");
    expect(cardPricingMigrationSql).toContain(
      'select public.sync_catalog_from_google_sheet(false);',
    );
  });
});

describe('catalog Supabase source-of-truth migration', () => {
  test('disables the reverse Google Sheets synchronization', () => {
    expect(catalogProjectionMigrationSql).toContain(
      'select public.unschedule_inventory_sync_cron();',
    );
    expect(catalogProjectionMigrationSql).toContain(
      'revoke all on function public.sync_catalog_from_google_sheet(boolean)',
    );
    expect(catalogProjectionMigrationSql).not.toContain('cron.schedule(');
  });

  test('records pending catalog projections with a versioned lease', () => {
    expect(catalogProjectionMigrationSql).toContain(
      'create table public.catalog_sheet_projection_state',
    );
    expect(catalogProjectionMigrationSql).toContain(
      'requested_version bigint not null default 1',
    );
    expect(catalogProjectionMigrationSql).toContain('lease_token uuid');
    expect(catalogProjectionMigrationSql).toContain(
      'create or replace function public.claim_catalog_sheet_projection()',
    );
    expect(catalogProjectionMigrationSql).toContain(
      'create or replace function public.complete_catalog_sheet_projection(',
    );
  });

  test('projects catalog rows through immutable external variant IDs', () => {
    expect(catalogProjectionMigrationSql).toContain(
      'create or replace function public.get_catalog_sheet_projection()',
    );
    expect(catalogProjectionMigrationSql).toContain('variant.nuvemshop_variant_id');
    expect(catalogProjectionMigrationSql).toContain("'Sem categoria'");
    expect(catalogProjectionMigrationSql).toContain("'Em estoque'");
  });
});
