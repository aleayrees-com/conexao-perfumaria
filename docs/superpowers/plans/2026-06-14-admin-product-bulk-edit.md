# Admin Product Bulk Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build safe bulk product editing and CSV export/import in the admin product area.

**Architecture:** Keep the risky business logic in pure tested utilities and server actions. Use a dedicated client component only for selection, local filtering, and preview, then submit exact IDs/operation fields to server actions.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase service role server-side, Vitest.

---

### Task 1: Bulk Utility Tests and Implementation

**Files:**

- Create: `src/lib/admin-product-bulk.ts`
- Create: `src/lib/admin-product-bulk.test.ts`

- [ ] Write tests for money operations: set, increase percent, decrease amount clamp, clear optional price.
- [ ] Write tests for CSV escaping/parsing with quoted commas and optional blank prices.
- [ ] Implement money helpers and CSV helpers until tests pass.

### Task 2: Admin Data Support

**Files:**

- Modify: `src/lib/admin-data.ts`

- [ ] Add `categoryId` and `compareAtPriceCents` to product summaries.
- [ ] Add audit log table typing and `insertAdminAuditLog`.
- [ ] Add `listAdminProductBulkRows` for CSV export.

### Task 3: Bulk Actions and Export Route

**Files:**

- Create: `src/app/admin/produtos/edicao-em-massa/actions.ts`
- Create: `src/app/admin/produtos/edicao-em-massa/export/route.ts`

- [ ] Add server action for bulk product operations.
- [ ] Add server action for CSV import.
- [ ] Add route handler for CSV export.
- [ ] Revalidate storefront catalog after successful writes.

### Task 4: Bulk UI

**Files:**

- Create: `src/components/admin/bulk-product-editor.tsx`
- Create: `src/app/admin/produtos/edicao-em-massa/page.tsx`
- Modify: `src/app/admin/produtos/page.tsx`
- Modify: `src/components/admin/admin-shell.tsx`
- Modify: `src/app/globals.css`

- [ ] Add a focused admin page with filters, selection, operation form, preview, export, and import.
- [ ] Link to bulk edit from product list and admin nav.
- [ ] Style the page with dense operational admin controls.

### Task 5: Verification and Deploy

**Files:**

- None.

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run prettier`.
- [ ] Run `npm run build`.
- [ ] Verify admin page locally or online.
- [ ] Deploy Production after validation.
