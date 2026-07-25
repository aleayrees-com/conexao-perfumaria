# Product Payment Price Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public PIX prices green and 12% more prominent while showing the card price in the store's purple.

**Architecture:** Extract the repeated public product-price markup into a small presentational component. Both the catalog card and detail page will use its semantic payment-price classes; global CSS will only control the two payment treatments and responsive scale.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest, CSS.

## Global Constraints

- Preserve existing payment copy, order, cent values and installment calculation.
- Use `--wine` for the card-price purple and define a dedicated accessible PIX-green token.
- Increase only the PIX value's font size by 12% in each public presentation.
- Do not alter checkout, catalog data, admin screens or product availability behavior.

---

### Task 1: Share payment-price presentation across catalog and product detail

**Files:**
- Create: `src/components/product-payment-price.tsx`
- Create: `src/components/product-payment-price.test.tsx`
- Modify: `src/components/product-card.tsx:1-57`
- Modify: `src/app/produtos/[slug]/page.tsx:1-81`
- Modify: `src/app/globals.css:1-20,1395-1413,3888-3903`

**Interfaces:**
- Consumes: `formatMoney(valueCents: number): string` and `getInstallmentText(valueCents: number, installments?: number): string` from `src/lib/money.ts`.
- Produces: `ProductPaymentPrice(props: ProductPaymentPriceProps): React.JSX.Element`, where `props` receives `className`, `priceCents`, and nullable `pixPriceCents`.

- [ ] **Step 1: Write the failing component test**

```tsx
it('labels card and PIX values independently', () => {
  const markup = renderToStaticMarkup(
    <ProductPaymentPrice
      className="price-stack"
      pixPriceCents={28491}
      priceCents={29990}
    />,
  );

  expect(markup).toContain('class="payment-card-price"');
  expect(markup).toContain('class="payment-pix-price"');
  expect(markup).toContain('R$ 284,91 no PIX');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/product-payment-price.test.tsx`

Expected: FAIL because `ProductPaymentPrice` does not exist.

- [ ] **Step 3: Implement the smallest shared presentation component**

```tsx
export function ProductPaymentPrice({
  className,
  pixPriceCents,
  priceCents,
}: ProductPaymentPriceProps) {
  return (
    <div className={className}>
      <strong className="payment-card-price">{formatMoney(priceCents)}</strong>
      <span>{getInstallmentText(priceCents)}</span>
      {pixPriceCents ? (
        <small className="payment-pix-price">
          {formatMoney(pixPriceCents)} no PIX
        </small>
      ) : null}
    </div>
  );
}
```

Replace the duplicated markup in `ProductCard` and `ProductPage` with this
component, retaining their current `price-stack` and `detail-price` classes.

- [ ] **Step 4: Add scoped payment-price styles**

```css
:root {
  --pix-green: #237a3f;
}

.payment-card-price {
  color: var(--wine);
}

.payment-pix-price {
  color: var(--pix-green);
  font-size: 0.96rem;
  font-weight: 600;
}
```

Maintain the 12% PIX emphasis in the mobile rules with `font-size: 0.8rem`.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- src/components/product-payment-price.test.tsx`

Expected: PASS with both semantic classes and PIX text in rendered output.

- [ ] **Step 6: Validate the application**

Run: `npm run lint && npm test && npm run build`

Expected: all commands finish successfully.

- [ ] **Step 7: Inspect a mobile and desktop product listing**

Run the local application and confirm the card price is purple, the PIX price
is green and 12% larger, no line wraps unexpectedly, and products without
PIX prices retain their original layout.

- [ ] **Step 8: Commit the implementation**

```bash
git add src/app/globals.css src/app/produtos/[slug]/page.tsx src/components/product-card.tsx src/components/product-payment-price.tsx src/components/product-payment-price.test.tsx docs/superpowers/plans/2026-07-25-product-payment-price-colors.md
git commit -m "feat: highlight PIX and card prices"
```
