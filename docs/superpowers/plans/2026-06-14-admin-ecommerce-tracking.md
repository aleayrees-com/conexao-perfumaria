# Admin Ecommerce Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable administrative area, real order persistence, and reliable ecommerce tracking for Conexao Perfumaria.

**Architecture:** Keep the storefront public and server-rendered, isolate `/admin` behind server-side authentication, and route all catalog/order mutations through guarded server code. Track ecommerce events through a shared browser event layer plus server-side Meta Conversions API for conversion events, with secrets stored only in server environment variables.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5.9, Supabase Postgres/Auth, Vitest, Google/GA4 ecommerce events, Meta Pixel + Conversions API, Microsoft Clarity.

---

### Task 1: Data And Auth Foundation

**Files:**

- Create: `supabase/migrations/20260614090000_admin_ecommerce_tracking.sql`
- Create: `src/lib/admin-auth.ts`
- Create: `src/lib/admin-data.ts`
- Modify: `src/lib/catalog.ts`
- Modify: `.env.example`

- [ ] Add schema changes for native products, admin profiles, audit logs, order events, and tracking events.
- [ ] Add Supabase admin helpers that are server-only and never expose service-role credentials to the browser.
- [ ] Add admin auth guard helpers.
- [ ] Add tests around helper validation where logic is local and deterministic.

### Task 2: Admin Layout And Product Operations

**Files:**

- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/produtos/page.tsx`
- Create: `src/app/admin/produtos/[id]/page.tsx`
- Create: `src/app/admin/produtos/actions.ts`
- Create: `src/components/admin/*`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/globals.css`

- [ ] Build a separate admin shell without public header, footer, or cart drawer.
- [ ] Build a dense product table with search, category/status filters, price, stock, publication status, and quick actions.
- [ ] Build a product editor for general data, pricing, stock, variants, images, and publication.
- [ ] Keep all writes behind server actions with validation and revalidation.

### Task 3: Orders And Real Checkout

**Files:**

- Create: `src/app/api/checkout/orders/route.ts`
- Create: `src/app/admin/pedidos/page.tsx`
- Create: `src/app/admin/pedidos/[orderNumber]/page.tsx`
- Create: `src/app/admin/pedidos/actions.ts`
- Modify: `src/app/api/checkout/whatsapp/route.ts`
- Modify: `src/lib/checkout-request.ts`
- Modify: `src/components/cart-drawer.tsx`
- Modify: `src/components/checkout-client.tsx`

- [ ] Create orders and order items in Supabase before opening WhatsApp.
- [ ] Return recalculated tracking payloads from the server.
- [ ] Add admin views for order list, order detail, status, payment status, internal notes, and WhatsApp handoff.
- [ ] Treat `purchase` as admin-confirmed/payment-confirmed, not merely WhatsApp opened.

### Task 4: Browser Tracking And Heatmap

**Files:**

- Create: `src/components/analytics-tags.tsx`
- Create: `src/components/page-view-tracker.tsx`
- Create: `src/lib/tracking.ts`
- Create: `src/lib/tracking.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/product-purchase-panel.tsx`
- Modify: `src/components/cart-drawer.tsx`
- Modify: `src/components/checkout-client.tsx`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] Load Google/GA4, Meta Pixel, and Clarity only when IDs are configured.
- [ ] Emit `page_view`, `add_to_cart`, `begin_checkout`, and admin-confirmed `purchase` events with GA4-compatible ecommerce payloads.
- [ ] Emit Meta Pixel events with matching event IDs for server-side deduplication.
- [ ] Avoid sending names, phones, addresses, or WhatsApp message content to browser analytics.

### Task 5: Meta Conversions API

**Files:**

- Create: `src/lib/meta-capi.ts`
- Create: `src/lib/meta-capi.test.ts`
- Create: `src/app/api/tracking/meta/route.ts`
- Modify: `src/app/api/checkout/orders/route.ts`
- Modify: `src/app/admin/pedidos/actions.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] Send server-side Meta events using server-only `META_CAPI_ACCESS_TOKEN`.
- [ ] Include `event_name`, `event_time`, `event_id`, `action_source`, `event_source_url`, `user_data`, and `custom_data`.
- [ ] Hash any customer identifiers before sending to Meta.
- [ ] Support `META_TEST_EVENT_CODE` for Events Manager validation.

### Task 6: Verification And Ship Readiness

**Files:**

- Modify: `PROJECT.md`
- Modify: `REQUIREMENTS.md`
- Modify: `ROADMAP.md`
- Modify: `STATE.md`

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start local dev server and verify public storefront, admin, checkout, and tracking debug paths.
- [ ] Update project docs with new admin/tracking behavior and required environment variables.
