# Automatic Card Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive the InfinitePay card price from each sheet PIX price using the 7.01% 3-installment, 1-business-day rate.

**Architecture:** A follow-up Supabase migration owns the payment-rate configuration and replaces the hourly sheet synchronization function. The sync reads PIX, stock and identification columns only, calculates the card price in cents with a round-up gross-up formula, then updates variants and product aggregates exactly as the existing sync does.

**Tech Stack:** PostgreSQL/Supabase migrations, pg_cron, Google Sheets Gviz CSV, TypeScript, Vitest.

## Global Constraints

- Keep the Google Sheets tab and hourly cron schedule already configured.
- Treat `Preço PIX` as the sole price entered by the customer in the sheet.
- Use 701 basis points and `ceil(pix * 10000 / (10000 - fee))` so the net card proceeds never fall below PIX.
- Keep the public schema configuration private; only `service_role` may access it.
- Preserve existing matching, stock, dry-run, run-history and manual RPC behavior.
- Follow test-first red/green cycles; every new database function must have a migration regression test.

---

## File Structure

- Create: `supabase/migrations/20260721120000_derive_card_price_from_pix.sql` — isolated production migration that holds the configurable 701-basis-point rate, the safe gross-up function and the replacement sheet sync function.
- Modify: `src/lib/catalog-sheet-sync-migration.test.ts` — regression coverage for the new migration contract.
- Create: `docs/superpowers/plans/2026-07-21-automatic-card-pricing.md` — this execution plan.

### Task 1: Lock the pricing migration contract with a failing test

**Files:**
- Modify: `src/lib/catalog-sheet-sync-migration.test.ts:1-55`
- Test: `src/lib/catalog-sheet-sync-migration.test.ts`

**Interfaces:**
- Consumes: migration file `supabase/migrations/20260721120000_derive_card_price_from_pix.sql`.
- Produces: regression assertions that define the configurable 701-basis-point rate and its round-up gross-up formula.

- [ ] **Step 1: Add a migration fixture and failing assertions**

```ts
const cardPricingMigrationUrl = new URL(
  '../../supabase/migrations/20260721120000_derive_card_price_from_pix.sql',
  import.meta.url,
);
const cardPricingMigrationPath = fileURLToPath(cardPricingMigrationUrl);
const cardPricingMigrationSql = existsSync(cardPricingMigrationPath)
  ? readFileSync(cardPricingMigrationPath, 'utf8')
  : '';

describe('automatic card pricing migration', () => {
  test('grosses up PIX with the 1-day InfinitePay rate', () => {
    expect(cardPricingMigrationSql).toContain(
      'card_fee_basis_points integer not null default 701',
    );
    expect(cardPricingMigrationSql).toContain(
      'ceil(pix_price_cents * 10000::numeric / (10000 - card_fee_basis_points))',
    );
  });

});
```

- [ ] **Step 2: Run the focused test to verify it fails because the migration is absent**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: the new suite fails because `cardPricingMigrationSql` is empty; existing inventory-sync tests remain green.

- [ ] **Step 3: Commit the red test only after observing the expected failure**

```bash
git add src/lib/catalog-sheet-sync-migration.test.ts
git commit -m "test: define automatic card pricing migration"
```

### Task 2: Add the centralized card-price configuration and calculation function

**Files:**
- Create: `supabase/migrations/20260721120000_derive_card_price_from_pix.sql:1-85`
- Test: `src/lib/catalog-sheet-sync-migration.test.ts`

**Interfaces:**
- Consumes: `pix_price_cents integer` and `card_fee_basis_points integer`.
- Produces: `public.calculate_catalog_card_price_cents(integer, integer) returns integer`, which rounds up the gross card amount.

- [ ] **Step 1: Create the singleton configuration table and seed the chosen rate**

```sql
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
```

- [ ] **Step 2: Implement the validated round-up calculator**

```sql
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
  if pix_price_cents < 0 then
    raise exception 'Preço PIX "%" inválido; esperado inteiro não negativo.', pix_price_cents;
  end if;

  if card_fee_basis_points < 0 or card_fee_basis_points >= 10000 then
    raise exception 'Taxa "%" inválida; esperado inteiro entre 0 e 9999 pontos-base.', card_fee_basis_points;
  end if;

  calculated_card_price_cents := ceil(
    pix_price_cents * 10000::numeric / (10000 - card_fee_basis_points)
  );

  if calculated_card_price_cents > 2147483647 then
    raise exception 'Preço calculado "%" inválido; esperado até 2147483647 centavos.', calculated_card_price_cents;
  end if;

  return calculated_card_price_cents::integer;
end;
$$;
```

- [ ] **Step 3: Protect the calculator from public execution**

```sql
revoke all on function public.calculate_catalog_card_price_cents(integer, integer)
  from public, anon, authenticated;
grant execute on function public.calculate_catalog_card_price_cents(integer, integer)
  to service_role;
```

- [ ] **Step 4: Run the focused test to verify the configuration and formula assertions pass**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: all tests in the file pass, including the 701-basis-point and `ceil` assertions.

- [ ] **Step 5: Commit the configuration and calculator**

```bash
git add supabase/migrations/20260721120000_derive_card_price_from_pix.sql \
  src/lib/catalog-sheet-sync-migration.test.ts
git commit -m "feat: calcula preco de cartao pelo PIX"
```

### Task 3: Replace the sheet synchronization source and derive card prices

**Files:**
- Modify: `supabase/migrations/20260721120000_derive_card_price_from_pix.sql:86-410`
- Test: `src/lib/catalog-sheet-sync-migration.test.ts`

**Interfaces:**
- Consumes: `public.catalog_card_pricing_settings`, `public.calculate_catalog_card_price_cents`, the existing Google Sheet columns B, I, J and L.
- Produces: `public.sync_catalog_from_google_sheet(boolean) returns jsonb` with unchanged dry-run/live result shape.

- [ ] **Step 1: Add the next failing migration contract tests**

```ts
test('uses PIX as the only sheet price source', () => {
  expect(cardPricingMigrationSql).toContain('select%20B%2CI%2CJ%2CL');
  expect(cardPricingMigrationSql).not.toContain('select%20B%2CH%2CI%2CJ%2CL');
  expect(cardPricingMigrationSql).toContain(
    '"ID Variação","Preço PIX","Unidades na loja","Link do produto"',
  );
});

test('rejects blank PIX values instead of deriving a three-percent discount', () => {
  expect(cardPricingMigrationSql).toContain("'Preço PIX'");
  expect(cardPricingMigrationSql).not.toContain('round(price_cents * 0.97)::integer');
});

test('keeps hourly scheduling and the manual sync entry point', () => {
  expect(cardPricingMigrationSql).toContain("'0 * * * *'");
  expect(cardPricingMigrationSql).toContain(
    'select public.sync_catalog_from_google_sheet(false);',
  );
});
```

- [ ] **Step 2: Run the focused test to verify the added source assertions fail**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: the two calculator assertions remain green and the new source-sync assertions fail because the replacement function has not yet been added.

- [ ] **Step 3: Replace the CSV source and header validation**

```sql
sheet_url constant text :=
  'https://docs.google.com/spreadsheets/d/1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/gviz/tq?tqx=out:csv&gid=257370644&tq=select%20B%2CI%2CJ%2CL';

if header <> '"ID Variação","Preço PIX","Unidades na loja","Link do produto"' then
  raise exception 'Cabeçalho "%" inválido; esperado ID, Preço PIX, estoque e link.', header;
end if;

csv_fields := regexp_match(
  csv_line,
  '^"([0-9]+)","([^"]*)","([0-9]+)","([^"]+)"$'
);
pix_price_text := csv_fields[2];
stock_text := csv_fields[3];
product_url := csv_fields[4];
```

- [ ] **Step 4: Read the central configuration and calculate the card price for every sheet row**

```sql
select settings.card_fee_basis_points
into card_fee_basis_points
from public.catalog_card_pricing_settings as settings
where settings.id;

if card_fee_basis_points is null then
  raise exception 'Configuração de cartão ausente; esperado uma taxa para recebimento em 1 dia útil.';
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
```

- [ ] **Step 5: Preserve the existing variant/product update behavior without a price fallback**

```sql
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

update public.product_variants as variant
set
  price_cents = incoming.price_cents,
  pix_price_cents = incoming.pix_price_cents,
  stock = incoming.stock,
  is_available = incoming.stock > 0
from pg_temp.catalog_sheet_resolved as incoming
where variant.nuvemshop_variant_id = incoming.resolved_variant_id;
```

The function body must retain the current direct-variant and unique-product-link matching queries, their duplicate-ID exceptions, the `catalog_sheet_changes` dry-run JSON, variant updates, product `min()` aggregation, the `sync_inventory_from_google_sheet` wrapper and the cron scheduling functions. Remove the `price_text` declaration and the `round(price_cents * 0.97)::integer` branch entirely. Add `cardFeeBasisPoints` to the run metadata and update the function comment to state that the card price is derived from the Sheet PIX price.

- [ ] **Step 6: Run focused migration regression tests**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: all migration tests pass and the new suite confirms that column H and the 3% fallback are absent from the new migration.

- [ ] **Step 7: Commit the replaced synchronization function**

```bash
git add supabase/migrations/20260721120000_derive_card_price_from_pix.sql \
  src/lib/catalog-sheet-sync-migration.test.ts
git commit -m "feat: deriva cartao do preco PIX da planilha"
```

### Task 4: Apply, synchronize and verify production state

**Files:**
- Modify: no source files beyond the committed migration.
- Test: production dry-run and live RPC result.

**Interfaces:**
- Consumes: the user-authorized Supabase PostgreSQL connection and `public.sync_catalog_from_google_sheet(boolean)`.
- Produces: live catalog rows where `price_cents` is the 7.01% gross-up of `pix_price_cents` and a run-history record carrying `cardFeeBasisPoints: 701`.

- [ ] **Step 1: Apply the migration with the configured database connection**

Run: `npm run migrate:supabase`

Expected: the migration ledger records `20260721120000_derive_card_price_from_pix.sql` with no SQL error.

- [ ] **Step 2: Perform a dry run and inspect its counter/result JSON**

Run: `psql "$DATABASE_URL" -c "select public.sync_catalog_from_google_sheet(true);"`

Expected: JSON has `ok: true`; it reports the rows that would change from manually-entered card prices to calculated card prices.

- [ ] **Step 3: Perform the authorized live synchronization**

Run: `psql "$DATABASE_URL" -c "select public.sync_catalog_from_google_sheet(false);"`

Expected: JSON has `ok: true`; all mapped variants receive the calculated card price, PIX price and stock.

- [ ] **Step 4: Verify exact rate behavior and cron setup in the database**

Run:

```bash
psql "$DATABASE_URL" -c "
select
  pix_price_cents,
  price_cents,
  public.calculate_catalog_card_price_cents(pix_price_cents, 701) as expected_price_cents
from public.product_variants
where pix_price_cents is not null
order by updated_at desc
limit 10;"
```

Expected: `price_cents` equals `expected_price_cents` for every returned row. Also query `cron.job` for `sync-catalog-every-hour` and confirm schedule `0 * * * *`.

- [ ] **Step 5: Run the full repository verification suite**

Run: `npm test && npm run build`

Expected: Vitest reports zero failures and the Next.js build exits 0.

- [ ] **Step 6: Commit any final verification-only source adjustments**

```bash
git status --short
git add supabase/migrations/20260721120000_derive_card_price_from_pix.sql \
  src/lib/catalog-sheet-sync-migration.test.ts
git commit -m "test: valida sincronizacao de preco no cartao"
```
