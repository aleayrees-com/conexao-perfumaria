# Google Sheets Inventory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the native Google Sheet inventory into Supabase every five minutes without changing storefront code.

**Architecture:** PostgreSQL fetches and validates the fixed `Produtos` CSV export through the `http` extension, then calls one transactional RPC. Supabase Cron invokes the database function directly every five minutes; activation follows a reviewed dry run and one verified live run.

**Tech Stack:** TypeScript 5.9, Vitest, PostgreSQL/PLpgSQL, PostgreSQL `http`, and Supabase Cron (`pg_cron`).

## Execution outcome

The Edge Function deployment was unavailable to the current Supabase account (`403`). Production already provided the synchronous PostgreSQL `http` extension, so the final implementation supersedes the Edge/Vault steps below with two additive migrations:

- `20260713190000_inventory_sheet_postgres_cron.sql` fetches the fixed Google Sheets CSV directly and schedules the database function every five minutes.
- `20260713191000_inventory_sheet_slug_fallback.sql` handles 10 sheet rows whose Nuvemshop IDs changed by using `Link do produto` only when its slug resolves to exactly one existing variant.

The final production verification read 411 rows, applied 35 stock differences, produced a zero-difference follow-up dry run, and recorded a successful automatic Cron execution. The original task breakdown remains below as implementation history; no Edge Function is part of the final runtime.

## Global Constraints

- Spreadsheet ID is `1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4`.
- Source tab is `Produtos`, `sheetId` `257370644`.
- Identity is `ID Variação`; stock is `Unidades na loja`.
- Synchronize stock only; do not change storefront components, prices, names, categories, or statuses.
- Never identify a variant by SKU or product name.
- Reject the complete run on malformed rows, duplicate IDs, unknown IDs, negative stock, or non-integer stock.
- Rows absent from the sheet are not changed or zeroed.
- No secret is committed or exposed to the browser.
- Preserve unrelated working-tree changes and keep `main` untouched without explicit approval.

## File Map

- `supabase/functions/_shared/inventory-sheet.ts`: RFC 4180 CSV parsing and inventory-row validation.
- `supabase/functions/_shared/inventory-handler.ts`: fetch, run logging, RPC orchestration, and HTTP responses through injected dependencies.
- `supabase/functions/sync-inventory/index.ts`: thin Deno/Supabase production adapter with fixed source URL.
- `src/lib/inventory-sheet.test.ts`: parser and validation regression tests.
- `src/lib/inventory-handler.test.ts`: dry-run, live-run, logging, and failure behavior tests.
- `supabase/migrations/20260713170000_inventory_sheet_sync.sql`: execution log, transactional RPC, extensions, privileges, and Cron scheduling helper.
- `src/lib/inventory-sync-migration.test.ts`: static SQL contract tests.
- `supabase/README.md`: exact local, dry-run, deployment, and activation workflow.

---

### Task 1: Parse and validate the live inventory CSV

**Files:**

- Create: `supabase/functions/_shared/inventory-sheet.ts`
- Create: `src/lib/inventory-sheet.test.ts`

**Interfaces:**

- Produces: `parseInventoryCsv(csv: string): InventorySnapshot`
- Produces: `InventoryRow { readonly nuvemshopVariantId: number; readonly stock: number; readonly sourceRow: number }`
- Produces: `InventorySheetError extends Error`

- [ ] **Step 1: Write failing parser tests**

Cover quoted commas, escaped quotes, CRLF, accents, blank SKU, reordered headers, blank trailing rows, missing/duplicate headers, blank stock, non-integer/negative stock, invalid IDs, and duplicate variation IDs. Import the production module directly:

```ts
import {
  InventorySheetError,
  parseInventoryCsv,
} from '../../supabase/functions/_shared/inventory-sheet';

expect(
  parseInventoryCsv(
    'Produto,Unidades na loja,ID Variação\r\n"Perfume, 100ml",2,123\r\n',
  ).rows,
).toEqual([{ nuvemshopVariantId: 123, stock: 2, sourceRow: 2 }]);
expect(() => parseInventoryCsv('ID Variação,Unidades na loja\n123,-1')).toThrow(
  InventorySheetError,
);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/inventory-sheet.test.ts`

Expected: FAIL because `inventory-sheet.ts` does not exist.

- [ ] **Step 3: Implement the parser and validation**

Implement a small state-machine CSV parser. Normalize headers with Unicode NFD, remove combining marks, trim whitespace, collapse internal whitespace, and lowercase. Require exactly one `id variacao` and one `unidades na loja` column. Ignore fully blank rows and reject partially populated inventory rows.

```ts
export interface InventoryRow {
  readonly nuvemshopVariantId: number;
  readonly stock: number;
  readonly sourceRow: number;
}

export interface InventorySnapshot {
  readonly rows: readonly InventoryRow[];
  readonly scannedRows: number;
}

export class InventorySheetError extends Error {}

export function parseInventoryCsv(csv: string): InventorySnapshot {
  const records = parseCsvRecords(csv);
  const headers = resolveHeaders(records[0]);
  const seen = new Set<number>();
  const rows = records.slice(1).flatMap((record, index) => {
    if (record.every((value) => value.trim() === '')) return [];
    const sourceRow = index + 2;
    const nuvemshopVariantId = parsePositiveInteger(
      record[headers.variantId],
      'ID Variação',
      sourceRow,
    );
    const stock = parseNonNegativeInteger(
      record[headers.stock],
      'Unidades na loja',
      sourceRow,
    );
    if (seen.has(nuvemshopVariantId)) {
      throw new InventorySheetError(
        `ID Variação duplicado na linha ${sourceRow}: ${nuvemshopVariantId}.`,
      );
    }
    seen.add(nuvemshopVariantId);
    return [{ nuvemshopVariantId, stock, sourceRow }];
  });
  return { rows, scannedRows: rows.length };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- src/lib/inventory-sheet.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 1**

```powershell
git add supabase/functions/_shared/inventory-sheet.ts src/lib/inventory-sheet.test.ts
git commit -m "feat: validate inventory sheet csv"
```

---

### Task 2: Add the atomic inventory synchronization RPC

**Files:**

- Create: `supabase/migrations/20260713170000_inventory_sheet_sync.sql`
- Create: `src/lib/inventory-sync-migration.test.ts`

**Interfaces:**

- Consumes: JSON array entries `{ "nuvemshopVariantId": number, "stock": number }`
- Produces: `public.sync_inventory_snapshot(inventory_rows jsonb, dry_run boolean)` returning one JSONB summary.
- Produces: `public.inventory_sync_runs` for operational logs.
- Produces: `public.schedule_inventory_sync_cron()` and `public.unschedule_inventory_sync_cron()`.

- [ ] **Step 1: Write failing SQL contract tests**

Read the migration with `node:fs/promises` and assert the exact contracts:

```ts
expect(sql).toContain('create table if not exists public.inventory_sync_runs');
expect(sql).toContain('pg_try_advisory_xact_lock');
expect(sql).toContain(
  'create or replace function public.sync_inventory_snapshot',
);
expect(sql).toContain('cron.schedule(');
expect(sql).toContain("'*/5 * * * *'");
expect(sql).toContain('vault.decrypted_secrets');
expect(sql).toContain('revoke all on function public.sync_inventory_snapshot');
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npm test -- src/lib/inventory-sync-migration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

The SQL must:

1. Enable `pg_cron`, `pg_net`, and `supabase_vault` when available.
2. Create `inventory_sync_runs` with status/mode checks and non-negative counters.
3. Enable RLS and revoke public access.
4. Define `sync_inventory_snapshot` as `security definer`, validate `jsonb_typeof(inventory_rows) = 'array'`, take `pg_try_advisory_xact_lock(hashtextextended('inventory-sheet-sync', 0))`, load rows into a temporary table, reject duplicates and unknown IDs, compute changes, and update only changed variants.
5. Let the existing row trigger refresh product totals after variant updates.
6. Return JSONB containing `scanned`, `changed`, `unchanged`, and `changes` with current/new stock.
7. Revoke RPC execution from `public`, `anon`, and `authenticated`; grant only to `service_role`.
8. Define scheduling helpers that read `inventory_sync_project_url` and `inventory_sync_service_role_key` from Vault, unschedule the existing named job, then call `cron.schedule('sync-inventory-every-5-minutes', '*/5 * * * *', ...)` with an authenticated `net.http_post`.

The live update statement must be set-based:

```sql
update public.product_variants as variant
set
  stock = incoming.stock,
  is_available = incoming.stock > 0
from pg_temp.inventory_sync_input as incoming
where variant.nuvemshop_variant_id = incoming.nuvemshop_variant_id
  and (variant.stock, variant.is_available)
    is distinct from (incoming.stock, incoming.stock > 0);
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- src/lib/inventory-sync-migration.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 2**

```powershell
git add supabase/migrations/20260713170000_inventory_sheet_sync.sql src/lib/inventory-sync-migration.test.ts
git commit -m "feat: add atomic inventory sync rpc"
```

---

### Task 3: Add the Edge Function with dry-run and audit logging

**Files:**

- Create: `supabase/functions/_shared/inventory-handler.ts`
- Create: `supabase/functions/sync-inventory/index.ts`
- Create: `src/lib/inventory-handler.test.ts`

**Interfaces:**

- Consumes: `parseInventoryCsv` from Task 1.
- Consumes: RPC `sync_inventory_snapshot` from Task 2.
- Produces: `createInventorySyncHandler(dependencies): (request: Request) => Promise<Response>`.
- Production request body: `{ "dryRun": boolean }`; Cron sends `{ "dryRun": false }`.

- [ ] **Step 1: Write failing handler tests**

Inject fetch and database operations so tests perform no network or Supabase writes:

```ts
const handler = createInventorySyncHandler({
  sheetCsvUrl: 'https://example.test/inventory.csv',
  fetchCsv: vi.fn().mockResolvedValue({
    ok: true,
    contentType: 'text/csv',
    text: 'ID Variação,Unidades na loja\n123,4',
  }),
  runs: fakeRuns,
  syncSnapshot: vi.fn().mockResolvedValue({
    scanned: 1,
    changed: 1,
    unchanged: 0,
    changes: [{ nuvemshopVariantId: 123, currentStock: 2, newStock: 4 }],
  }),
});

const response = await handler(
  new Request('https://example.test', {
    method: 'POST',
    body: JSON.stringify({ dryRun: true }),
  }),
);
expect(await response.json()).toMatchObject({
  ok: true,
  dryRun: true,
  changed: 1,
});
```

Also cover GET/invalid method, malformed JSON, fetch error, wrong content type, parser error, RPC error, success logging, error logging, and secret-free error responses.

- [ ] **Step 2: Run handler tests and verify RED**

Run: `npm test -- src/lib/inventory-handler.test.ts`

Expected: FAIL because the handler module does not exist.

- [ ] **Step 3: Implement the injected handler**

The handler must accept POST only, default `dryRun` to `false`, create a `running` log, fetch and parse CSV, call the RPC once, update the run to `success`, and sanitize caught errors before updating the run to `error`.

```ts
export interface InventorySyncDependencies {
  readonly sheetCsvUrl: string;
  readonly fetchCsv: (url: string) => Promise<CsvFetchResult>;
  readonly runs: InventoryRunStore;
  readonly syncSnapshot: (
    rows: readonly InventoryRow[],
    dryRun: boolean,
  ) => Promise<InventorySyncSummary>;
}

export function createInventorySyncHandler(
  dependencies: InventorySyncDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') {
      return Response.json(
        { ok: false, error: 'Método não permitido.' },
        { status: 405 },
      );
    }
    const { dryRun } = await readRequestBody(request);
    const runId = await dependencies.runs.start(dryRun);

    try {
      const csvResponse = await dependencies.fetchCsv(dependencies.sheetCsvUrl);
      if (
        !csvResponse.ok ||
        !csvResponse.contentType.toLowerCase().includes('text/csv')
      ) {
        throw new Error('Falha ao baixar o CSV de estoque.');
      }
      const snapshot = parseInventoryCsv(csvResponse.text);
      const summary = await dependencies.syncSnapshot(snapshot.rows, dryRun);
      await dependencies.runs.succeed(runId, summary);
      return Response.json({ ok: true, dryRun, ...summary });
    } catch (error: unknown) {
      const message = sanitizeError(error);
      await dependencies.runs.fail(runId, message);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  };
}
```

- [ ] **Step 4: Implement the production adapter**

Use the fixed CSV URL:

```ts
const sheetCsvUrl =
  'https://docs.google.com/spreadsheets/d/1vAcEwE1-cH3s4TAdFa5ib1P037g9m-MXt0DpV1mxzI4/export?format=csv&gid=257370644';
```

Create the Supabase client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, implement the run store against `inventory_sync_runs`, call `.rpc('sync_inventory_snapshot', { inventory_rows, dry_run })`, and expose `Deno.serve(handler)`. Never log the key or full CSV.

- [ ] **Step 5: Run focused tests, typecheck, lint, and full tests**

Run: `npm test -- src/lib/inventory-handler.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0.

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 3**

```powershell
git add supabase/functions/_shared/inventory-handler.ts supabase/functions/sync-inventory/index.ts src/lib/inventory-handler.test.ts
git commit -m "feat: add scheduled inventory edge function"
```

---

### Task 4: Verify locally, apply the migration, and perform a guarded rollout

**Files:**

- Modify: `supabase/README.md`

**Interfaces:**

- Applies `supabase/migrations/20260713170000_inventory_sheet_sync.sql` through the existing migration runner and configured `SUPABASE_DB_URL`.
- Produces exact Dashboard/CLI instructions for deploying `supabase/functions/sync-inventory` if CLI authentication is unavailable.
- Keeps Cron disabled until dry-run and live verification pass.

- [ ] **Step 1: Document the guarded Supabase rollout**

Update `supabase/README.md` with this order:

1. Apply the migration through `npm run migrate:supabase` using the configured `SUPABASE_DB_URL`.
2. Deploy the Edge Function from `supabase/functions/sync-inventory` without disabling JWT verification.
3. Store `inventory_sync_project_url` and `inventory_sync_service_role_key` in Supabase Vault through the Dashboard.
4. Invoke the Edge Function with `{"dryRun":true}` and inspect the response.
5. Invoke once with `{"dryRun":false}` only after the dry-run differences are approved.
6. Enable the schedule with `select public.schedule_inventory_sync_cron();`.
7. Disable immediately with `select public.unschedule_inventory_sync_cron();`.

The instructions must clearly separate migration application, Edge Function deployment, dry run, live run, and Cron activation.

- [ ] **Step 2: Run complete local verification**

Run: `npm run prettier`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0.

Run: `npx tsc --noEmit`

Expected: exit 0.

Run: `npm test`

Expected: all tests pass with no `.only` or `.skip`.

Run: `npm run build`

Expected: successful production build using the existing local environment.

- [ ] **Step 3: Commit Task 4**

```powershell
git add supabase/README.md
git commit -m "docs: add manual inventory sync rollout"
```

- [ ] **Step 4: Apply the migration automatically**

Load `SUPABASE_DB_URL` from the existing ignored local environment file without printing it, verify that the project reference is `nhbopjnibuxfpkslbawf`, and run `npm run migrate:supabase`. Confirm the migration ledger contains `20260713170000_inventory_sheet_sync.sql`.

- [ ] **Step 5: Deploy and dry-run without enabling Cron**

Attempt the authenticated Supabase CLI deployment. If CLI authentication is unavailable, hand off the exact Edge Function file for Dashboard deployment. Once deployed, invoke `{"dryRun":true}` and present the exact difference summary. Do not run live synchronization or enable Cron before the dry-run result is reviewed.
