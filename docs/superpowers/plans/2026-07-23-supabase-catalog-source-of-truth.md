# Supabase Catalog Source of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Google Sheets from overwriting ADM edits and reliably project the Supabase catalog back to `Produtos`.

**Architecture:** PostgreSQL owns a versioned projection state and is updated transactionally by catalog triggers. A protected Next.js worker claims a version, reads a complete immutable-ID snapshot from Supabase, updates only the managed sheet columns, and completes or releases the lease.

**Tech Stack:** Next.js 16, TypeScript 5.9, Supabase PostgreSQL, `@supabase/supabase-js`, Google Sheets API, Vitest.

## Global Constraints

- Supabase is the sole catalog source of truth; no code may update catalog data from the Sheet.
- Match rows exclusively by `product_variants.nuvemshop_variant_id`, never by name, SKU, or slug.
- Preserve `Produtos!K:K` until a canonical inventory-value source is defined.
- Google service-account credentials are runtime secrets and must not be written to SQL, source, tests, or logs.
- The production migration must keep `392` products and `411` variants intact.

---

### Task 1: Disable the reverse synchronization safely

**Files:**
- Create: `supabase/migrations/20260723110000_catalog_supabase_source_of_truth.sql`
- Modify: `src/lib/catalog-sheet-sync-migration.test.ts`

**Interfaces:**
- Consumes: legacy `public.unschedule_inventory_sync_cron()`.
- Produces: no active `sync-catalog-every-hour` job and no service-role access to `sync_catalog_from_google_sheet`.

- [ ] **Step 1: Write the failing migration contract test**

```ts
expect(migrationSql).toContain('select public.unschedule_inventory_sync_cron();');
expect(migrationSql).toContain(
  'revoke all on function public.sync_catalog_from_google_sheet(boolean)',
);
expect(migrationSql).not.toContain("cron.schedule(");
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: FAIL because the new migration does not yet exist.

- [ ] **Step 3: Create the migration**

```sql
select public.unschedule_inventory_sync_cron();
revoke all on function public.sync_catalog_from_google_sheet(boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.sync_inventory_from_google_sheet(boolean)
  from public, anon, authenticated, service_role;
```

- [ ] **Step 4: Run the focused test and apply with the Session Pooler**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: PASS.

Run the migration and verify with:

```sql
select jobname from cron.job where active and jobname = 'sync-catalog-every-hour';
```

Expected: zero rows.

### Task 2: Add durable projection state

**Files:**
- Modify: `supabase/migrations/20260723110000_catalog_supabase_source_of_truth.sql`
- Modify: `src/lib/catalog-sheet-sync-migration.test.ts`

**Interfaces:**
- Produces: `public.catalog_sheet_projection_state`, `request_catalog_sheet_projection()`, `claim_catalog_sheet_projection()`, `complete_catalog_sheet_projection(uuid, bigint)`, and `fail_catalog_sheet_projection(uuid, text)`.

- [ ] **Step 1: Write failing contract tests for a single versioned state row and a lease token**

```ts
expect(migrationSql).toContain('create table public.catalog_sheet_projection_state');
expect(migrationSql).toContain('requested_version bigint not null default 1');
expect(migrationSql).toContain('lease_token uuid');
expect(migrationSql).toContain('create or replace function public.claim_catalog_sheet_projection()');
expect(migrationSql).toContain('create or replace function public.complete_catalog_sheet_projection');
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: FAIL with a missing projection-state assertion.

- [ ] **Step 3: Implement the table and functions**

```sql
create table public.catalog_sheet_projection_state (
  singleton boolean primary key default true check (singleton),
  requested_version bigint not null default 1 check (requested_version >= 1),
  completed_version bigint not null default 0 check (completed_version >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
```

The claim function must atomically update only an expired-or-empty lease when `completed_version < requested_version`; completion must advance only the claimed version; failure must clear only the matching token. Add `AFTER INSERT OR UPDATE OR DELETE` triggers on `products`, `product_variants`, and `categories` that call `request_catalog_sheet_projection()`.

- [ ] **Step 4: Run the focused test and apply the migration**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: PASS.

Run: `npm run migrate:supabase`

Expected: migration ledger contains `20260723110000_catalog_supabase_source_of_truth.sql`.

### Task 3: Export a validated immutable-ID snapshot

**Files:**
- Modify: `supabase/migrations/20260723110000_catalog_supabase_source_of_truth.sql`
- Test: `src/lib/catalog-sheet-sync-migration.test.ts`

**Interfaces:**
- Produces: `public.get_catalog_sheet_projection()` returning the 11 managed values for each variant.

- [ ] **Step 1: Write the failing projection-function assertions**

```ts
expect(migrationSql).toContain('create or replace function public.get_catalog_sheet_projection()');
expect(migrationSql).toContain('variant.nuvemshop_variant_id');
expect(migrationSql).toContain("'Sem categoria'");
expect(migrationSql).toContain("'Em estoque'");
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/lib/catalog-sheet-sync-migration.test.ts`

Expected: FAIL because the function is absent.

- [ ] **Step 3: Implement the snapshot**

Select product/variant IDs, SKU, names, category, derived status, monetary values divided by 100, stock, and `source_url` from `products`, `product_variants`, and `categories`. Order by `nuvemshop_variant_id`; do not select, derive, or update column K.

- [ ] **Step 4: Verify production cardinality after applying**

Run:

```sql
select count(*) as variants,
       count(distinct product_id) as products,
       count(distinct variant_id) as distinct_variants
from public.get_catalog_sheet_projection();
```

Expected: `411`, `392`, and `411`.

### Task 4: Add the protected Google Sheets writer

**Files:**
- Create: `src/lib/catalog-sheet-projection.ts`
- Create: `src/lib/catalog-sheet-projection.test.ts`
- Create: `src/app/api/internal/catalog-sheet-projection/route.ts`
- Modify: `package.json`
- Modify: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: the claim/snapshot/complete/fail RPCs and runtime `GOOGLE_SERVICE_ACCOUNT_*`, `CATALOG_SHEET_ID`, and `CRON_SECRET` variables.
- Produces: one authenticated worker route that writes `Produtos!A:J,L` and leaves column K unchanged.

- [ ] **Step 1: Write failing unit tests with named fake dependencies**

```ts
class FakeProjectionGateway {
  public completedVersions: number[] = [];
  async claim() { return { token: 'token', version: 1 }; }
  async rows() { return fixtureRows; }
  async complete(_token: string, version: number) { this.completedVersions.push(version); }
}

class FakeSheetWriter {
  public writes: readonly unknown[][] = [];
  async replaceManagedCatalog(values: readonly unknown[][]) { this.writes = values; }
}
```

Assert that the worker rejects duplicate variant IDs, preserves the empty K-column position, completes only after a successful write, and records a failure when the writer rejects.

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npm test -- src/lib/catalog-sheet-projection.test.ts`

Expected: FAIL because the worker module does not exist.

- [ ] **Step 3: Implement the worker and route**

Use injected `ProjectionGateway` and `SheetWriter` interfaces. Use the official Google client behind `GoogleCatalogSheetWriter`; write `A:J` plus `L` in a coherent batch and never include column K. Require `Authorization: Bearer ${CRON_SECRET}` before any claim. The route must emit structured JSON with the claimed version and outcome, but never credentials or full catalog data.

- [ ] **Step 4: Configure deployment secrets and schedule a retry**

Add the service-account values and `CRON_SECRET` in the deployment environment, grant the service account Editor access to the spreadsheet, and configure a protected five-minute cron request to `/api/internal/catalog-sheet-projection`.

- [ ] **Step 5: Run quality gates and a live reconciliation**

Run: `npm run lint; npm test; npm run build`

Expected: all commands pass.

Invoke the route once, verify `Produtos` has 411 non-placeholder variant rows, 392 distinct IDs in column A, 411 distinct IDs in column B, and no write to K.
