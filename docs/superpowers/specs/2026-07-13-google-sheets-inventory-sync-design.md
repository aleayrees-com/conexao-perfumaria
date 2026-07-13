# Google Sheets Inventory Sync Design

## Goal

Make the client's Google Sheet the operational source of truth for variant inventory while keeping the storefront unchanged. Every five minutes, synchronize stock differences into Supabase so the existing catalog and checkout flows continue reading current inventory from the database.

## Current System

- The storefront reads products and variants from Supabase in `src/lib/catalog.ts`.
- Variant inventory is stored in `public.product_variants.stock` and `public.product_variants.is_available`.
- Product-level inventory is stored in `public.products.total_stock` and `public.products.is_available`.
- The existing `refresh_product_stock` RPC recalculates product-level inventory after variant changes.
- There is no existing scheduled inventory integration or `supabase/functions` implementation to extend.
- The emergency JSON catalog remains unchanged and is not part of this synchronization.

## Source Contract

- Spreadsheet ID: `1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4`.
- Spreadsheet title: `conexao-produtos-valores-estoque`.
- Source tab: `Produtos`.
- Source tab `sheetId`: `257370644`.
- Header row: row 1.
- Variant identity column: `B`, header `ID Variação`.
- Inventory column: `J`, header `Unidades na loja`.
- The client may edit inventory in column `J`; names, SKUs, statuses, and prices are not synchronization inputs.
- The sync fetches the native Google Sheets CSV export for the `Produtos` tab. The public read endpoint was verified to return HTTP 200 and CSV content.

The user-facing link opens the `Resumo` tab, but inventory synchronization must always target `Produtos` by its explicit `sheetId`. Tab position and the active tab in the browser are not part of the contract.

## Recommended Architecture

### 1. Supabase Edge Function

Add a versioned Edge Function at `supabase/functions/sync-inventory` with one responsibility: download, parse, validate, and submit one inventory snapshot.

The function will:

1. Fetch the `Produtos` tab as CSV.
2. Resolve the required columns by normalized header text rather than fixed array offsets alone.
3. Build rows containing only `nuvemshop_variant_id` and `stock`.
4. Validate the complete snapshot before requesting any database write.
5. Call one PostgreSQL RPC with the validated rows and a `dry_run` flag.
6. Return compact counts for scanned, changed, unchanged, and rejected rows.

### 2. Transactional PostgreSQL RPC

Add a migration defining an inventory-sync RPC that accepts the validated snapshot as JSON. One RPC call provides one database transaction.

The RPC will:

- acquire a transaction-scoped advisory lock so scheduled runs cannot overlap;
- reject duplicate variation IDs;
- reject variation IDs that do not exist in `product_variants.nuvemshop_variant_id`;
- compare incoming stock with current stock;
- update only changed variants;
- set variant `is_available` to `stock > 0`;
- refresh every affected product through the existing product-stock calculation;
- return the planned changes without writing when `dry_run = true`.

Rows missing from the spreadsheet snapshot will not be changed or set to zero.

### 3. Supabase Cron

Create one Supabase Cron job using the schedule `*/5 * * * *`. The job invokes the Edge Function through `pg_net`. Invocation credentials are stored in Supabase Vault, not embedded in SQL or committed files.

The Cron job remains disabled until the first dry run has been reviewed and a live one-off synchronization succeeds.

### 4. Execution Log

Add an `inventory_sync_runs` table for operational visibility. Each run records:

- start and finish timestamps;
- mode: `dry_run` or `live`;
- status: `running`, `success`, or `error`;
- scanned, changed, and unchanged counts;
- a sanitized error summary when applicable.

Logs must not contain credentials, authorization headers, or complete spreadsheet payloads.

## Validation Rules

The Edge Function must reject the complete run before writes when:

- the CSV request fails or does not return CSV;
- either required header is missing or appears more than once;
- `ID Variação` is blank on a row that contains stock;
- `ID Variação` is not a positive integer;
- `Unidades na loja` is blank for a populated product row;
- stock is not an integer or is negative;
- the same variation ID appears more than once;
- a variation ID is not present in Supabase.

Fully blank trailing rows are ignored. SKU and product name are informational and never used as fallback identifiers.

## Failure Behavior

- Fetch, parsing, or validation failure results in zero inventory writes.
- RPC validation or database failure rolls back the complete inventory update.
- A failed run is logged with a sanitized reason and will be retried by the next five-minute schedule.
- The function returns a non-success HTTP status for operational failures so Edge Function and Cron monitoring expose them.
- One failed run never changes storefront code, the local JSON snapshot, or unrelated product fields.

## Security

- The spreadsheet is read-only to the synchronization process.
- The Edge Function accepts only authenticated automation calls; it is not a public mutation endpoint.
- Supabase secrets remain in Edge Function environment variables or Vault.
- The secret/service key is never exposed to the browser or committed to the repository.
- Database writes use the narrow inventory RPC rather than general-purpose table mutation from the client.
- The current spreadsheet sharing mode allows anyone with the link to read it. This is accepted for the CSV-fetch design; editor access remains separately controlled by Google Drive sharing.

## Testing

### Unit tests

- CSV parsing with quoted fields, accents, CRLF, and blank SKU values.
- Header normalization and missing/duplicate header rejection.
- Positive integer parsing for variation IDs and non-negative integer parsing for stock.
- Duplicate ID rejection.
- Blank trailing row handling.
- Difference calculation and dry-run response shape.

### Database contract tests

- The migration creates the RPC, execution-log table, constraints, and required privileges.
- Dry run produces differences without modifying variants or products.
- Live mode updates only changed variants.
- Unknown IDs and duplicates abort the transaction.
- Product totals and availability are refreshed after variant changes.
- Concurrent execution is rejected or serialized by the advisory lock.

### Integration verification

1. Fetch the live `Produtos` CSV without modifying the sheet.
2. Run the function locally in dry-run mode against the configured Supabase environment.
3. Present the exact difference summary for approval.
4. Execute one live synchronization and verify representative changed and unchanged variants.
5. Verify storefront and checkout stock reads against Supabase.
6. Enable the five-minute Cron job only after the live one-off verification passes.

## Rollout And Git Boundaries

- Implementation occurs on the current work branch without touching `main`.
- Existing unrelated working-tree changes are preserved and excluded from inventory-sync commits.
- Local tests and dry-run evidence are shown before applying the production migration, deploying the Edge Function, or enabling Cron.
- No push or merge to `main` occurs without explicit user approval.

## Out Of Scope

- Synchronizing prices, PIX prices, names, categories, statuses, or product descriptions.
- Writing Supabase values back into the spreadsheet.
- Replacing the existing admin product editor.
- Changing storefront components, pages, cart behavior, or checkout behavior.
- Setting inventory to zero merely because a product is absent from the sheet.
