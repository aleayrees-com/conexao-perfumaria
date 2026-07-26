# Supabase Catalog Source of Truth Design

## Goal

Make the ADM the only place that changes the catalog: ADM writes to Supabase and the `Produtos` tab becomes a read-only projection of those records.

## Current Facts

- Supabase contains 392 products and 411 variants, matching the valid rows in `Produtos`.
- The existing `sync-catalog-every-hour` cron reads Google Sheets and updates Supabase. That direction permits the sheet to overwrite ADM edits.
- Row 413 in `Produtos` was only `-` placeholders and is not a catalog row.
- `Valor em estoque` (column K) has no source field in the current Supabase schema. It must not be fabricated or overwritten until a cost/inventory-value source is defined.

## Decision

1. Disable and revoke the legacy Sheet-to-Supabase sync.
2. Supabase is canonical for the managed catalog fields: external product ID, external variant ID, SKU, product name, variant label, category, availability, regular price, PIX price, stock, and product URL.
3. PostgreSQL records a monotonically increasing projection version whenever products, variants, or categories change. It does not call Google directly.
4. A protected application worker claims one pending version, exports the complete 411-variant snapshot by immutable variant ID, writes it to `Produtos!A:J,L`, and marks that version complete. If a new ADM update occurs during the export, the newer version remains pending.
5. A failed worker releases its lease and leaves the version pending for retry. The ADM write remains successful because the data is already durable in Supabase.
6. Column K remains untouched and is documented as outside the current projection contract; this preserves existing values without claiming they are synchronized.

## Projection Contract

| Sheet column | Supabase field | Key rule |
| --- | --- | --- |
| A | `products.nuvemshop_product_id` | immutable external product ID |
| B | `product_variants.nuvemshop_variant_id` | immutable external variant ID; one row per ID |
| C | `product_variants.sku` | blank when null |
| D | `products.name` | direct value |
| E | `product_variants.label` | direct value |
| F | `categories.name` | `Sem categoria` when null |
| G | `product_variants.stock` and `is_available` | `Em estoque` only when both are available and stock is positive |
| H | `product_variants.price_cents` | BRL numeric value |
| I | `product_variants.pix_price_cents` | BRL numeric value; blank when null |
| J | `product_variants.stock` | non-negative integer |
| K | no canonical source yet | preserved, never written by the worker |
| L | `products.source_url` | direct value |

## Operational Rules

- The protected worker needs a Google service account with editor access to the supplied spreadsheet. Its credentials are runtime secrets, never database fields or repository files.
- While those credentials are not configured, the database still records pending projection work and cannot lose an ADM update; the Google write is the only deferred step.
- The worker uses the exact spreadsheet ID `1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4` and `Produtos` sheet ID `257370644`.
- The worker writes in batches and verifies that it exported exactly 392 unique product IDs and 411 unique variant IDs before completing a version.
