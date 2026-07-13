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
- Product-link fallback column: `L`, header `Link do produto`.
- The client may edit inventory in column `J`; names, SKUs, statuses, and prices are not synchronization inputs.
- The sync fetches the native Google Sheets CSV export for the `Produtos` tab. The public read endpoint was verified to return HTTP 200 and CSV content.

The user-facing link opens the `Resumo` tab, but inventory synchronization must always target `Produtos` by its explicit `sheetId`. Tab position and the active tab in the browser are not part of the contract.

## Recommended Architecture

### 1. Direct PostgreSQL fetch

The production project exposes the synchronous `http` extension, so PostgreSQL fetches the fixed Google Sheets `gviz` CSV endpoint directly. This removes the Edge Function deployment and Vault credential dependency while keeping the storefront unchanged.

The database function `sync_inventory_from_google_sheet`:

1. Fetches only columns `B`, `J`, and `L` from the `Produtos` tab.
2. Validates HTTP status, CSV content type, exact headers, IDs, stock values, links, and duplicates.
3. Resolves a row by `ID Variação` first.
4. When that ID is legacy or replaced, uses the link slug only if it maps to exactly one existing database variant.
5. Calls the transactional snapshot RPC with a `dry_run` flag.
6. Returns counts for scanned, changed, unchanged, and slug-fallback rows.

### 2. Transactional PostgreSQL RPC

Add a migration defining an inventory-sync RPC that accepts the validated snapshot as JSON. One RPC call provides one database transaction.

The RPC will:

- acquire a transaction-scoped advisory lock so scheduled runs cannot overlap;
- reject duplicate variation IDs;
- reject variation IDs that neither exist directly nor have one unambiguous product-slug match;
- compare incoming stock with current stock;
- update only changed variants;
- set variant `is_available` to `stock > 0`;
- refresh every affected product through the existing product-stock calculation;
- return the planned changes without writing when `dry_run = true`.

Rows missing from the spreadsheet snapshot will not be changed or set to zero.

### 3. Supabase Cron

Create one Supabase Cron job using the schedule `*/5 * * * *`. The job directly invokes `sync_inventory_from_google_sheet(false)` as a database command, with no HTTP mutation endpoint or application credential.

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

The database function must reject the complete run before writes when:

- the CSV request fails or does not return CSV;
- any required header is missing or unexpected;
- `ID Variação` is blank on a row that contains stock;
- `ID Variação` is not a positive integer;
- `Unidades na loja` is blank for a populated product row;
- stock is not an integer or is negative;
- the same variation ID appears more than once;
- a variation ID has no direct match and its product slug has zero or multiple variants;
- two sheet rows resolve to the same database variant.

Fully blank trailing rows are ignored. SKU and product name are informational and never used as fallback identifiers.

## Failure Behavior

- Fetch, parsing, or validation failure results in zero inventory writes.
- RPC validation or database failure rolls back the complete inventory update.
- A failed run is logged with a sanitized reason and will be retried by the next five-minute schedule.
- The function records an error result in `inventory_sync_runs`; PostgreSQL Cron history remains available in `cron.job_run_details`.
- One failed run never changes storefront code, the local JSON snapshot, or unrelated product fields.

## Security

- The spreadsheet is read-only to the synchronization process.
- The synchronization functions are revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`.
- No service key, database URL, or sheet payload is embedded in logs or committed files.
- Database writes use the narrow inventory RPC rather than general-purpose table mutation from the client.
- The current spreadsheet sharing mode allows anyone with the link to read it. This is accepted for the CSV-fetch design; editor access remains separately controlled by Google Drive sharing.

## Testing

### Contract tests

- Fixed spreadsheet, tab, selected columns, headers, and five-minute schedule.
- Positive integer validation for variation IDs and non-negative integer validation for stock.
- Direct-ID priority, single-variant slug fallback, duplicate-target rejection, and immutable identifiers.
- Difference calculation, execution logging, and dry-run response shape.

### Database contract tests

- The migration creates the RPC, execution-log table, constraints, and required privileges.
- Dry run produces differences without modifying variants or products.
- Live mode updates only changed variants.
- Unknown IDs and duplicates abort the transaction.
- Product totals and availability are refreshed after variant changes.
- Concurrent execution is rejected or serialized by the advisory lock.

### Integration verification

1. Fetch the live `Produtos` CSV without modifying the sheet.
2. Run the database function in dry-run mode against the configured Supabase environment.
3. Review the exact difference summary.
4. Execute one live synchronization and immediately verify a second dry run reports zero changes.
5. Enable the five-minute Cron job only after the live one-off verification passes.
6. Confirm a real scheduled run in both `cron.job_run_details` and `inventory_sync_runs`.

## Rollout And Git Boundaries

- Implementation occurs on the current work branch without touching `main`.
- Existing unrelated working-tree changes are preserved and excluded from inventory-sync commits.
- Local tests and dry-run evidence are captured before enabling Cron.
- No push or merge to `main` occurs without explicit user approval.

## Out Of Scope

- Synchronizing prices, PIX prices, names, categories, statuses, or product descriptions.
- Writing Supabase values back into the spreadsheet.
- Replacing the existing admin product editor.
- Changing storefront components, pages, cart behavior, or checkout behavior.
- Setting inventory to zero merely because a product is absent from the sheet.
