# Admin Product Bulk Edit Design

## Goal

Add safe bulk editing for catalog operations in the admin area, covering both in-panel batch actions and CSV export/import.

## Scope

- Add a dedicated admin route at `/admin/produtos/edicao-em-massa`.
- Allow product filtering by text, status, category, and stock state.
- Allow selecting filtered products and applying one operation at a time.
- Show a client-side preview before submitting the operation.
- Require an explicit confirmation word for destructive or broad changes.
- Export editable CSV rows with product and variant fields.
- Import the same CSV shape and apply product/variant updates server-side.
- Log bulk actions and CSV imports in `admin_audit_logs`.

## Operations

- Product status: `active`, `draft`, `archived`.
- Category: set category or clear category.
- Product and variant money fields: product price, PIX price, compare-at price.
- Price modes: set value, increase percent, decrease percent, increase amount, decrease amount, clear optional price.
- Variant stock: set, increase, decrease.
- Variant availability: set available or unavailable.

## Safety

- All writes run through server actions guarded by `requireAdmin`.
- The client submits exact product IDs, not only a filter expression.
- Server actions cap batch sizes and re-read current database values before applying price/stock calculations.
- Product stock is refreshed through existing `refresh_product_stock` RPC/trigger behavior.
- Storefront catalog paths are revalidated after successful writes.

## CSV Contract

CSV export emits one row per product variant with:

`product_id`, `slug`, `name`, `status`, `category_id`, `price`, `pix_price`, `compare_at_price`, `variant_id`, `variant_label`, `variant_sku`, `variant_price`, `variant_pix_price`, `variant_compare_at_price`, `variant_stock`, `variant_available`

Import accepts the same headers. Blank optional price fields clear the optional price. Blank required price fields are ignored. Blank category clears the product category.
