import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationUrl = new URL(
  '../../supabase/migrations/20260720190000_catalog_sheet_hourly_sync.sql',
  import.meta.url,
);
const migrationPath = fileURLToPath(migrationUrl);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, 'utf8')
  : '';
const cardPricingMigrationUrl = new URL(
  '../../supabase/migrations/20260721120000_derive_card_price_from_pix.sql',
  import.meta.url,
);
const cardPricingMigrationPath = fileURLToPath(cardPricingMigrationUrl);
const cardPricingMigrationSql = existsSync(cardPricingMigrationPath)
  ? readFileSync(cardPricingMigrationPath, 'utf8')
  : '';

describe('catalog sheet sync migration', () => {
  test('reads prices and stock from the configured Produtos sheet', () => {
    expect(migrationSql).toContain(
      '1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4',
    );
    expect(migrationSql).toContain('gid=257370644');
    expect(migrationSql).toContain('select%20B%2CH%2CI%2CJ%2CL');
  });

  test('updates variant and product prices together with stock', () => {
    expect(migrationSql).toContain('price_cents = incoming.price_cents');
    expect(migrationSql).toContain(
      'pix_price_cents = incoming.pix_price_cents',
    );
    expect(migrationSql).toContain('price_cents = aggregate.min_price_cents');
    expect(migrationSql).toContain(
      'pix_price_cents = aggregate.min_pix_price_cents',
    );
    expect(migrationSql).toContain('stock = incoming.stock');
  });

  test('derives a three-percent PIX discount when the sheet cell is blank', () => {
    expect(migrationSql).toContain('round(price_cents * 0.97)::integer');
  });

  test('runs hourly and remains callable manually', () => {
    expect(migrationSql).toContain("'0 * * * *'");
    expect(migrationSql).toContain(
      'select public.sync_catalog_from_google_sheet(false);',
    );
  });

  test('uses unambiguous run counters when updating sync history', () => {
    expect(migrationSql).toContain('sync_scanned_count integer;');
    expect(migrationSql).toContain('scanned_count = sync_scanned_count');
    expect(migrationSql).not.toContain(
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
