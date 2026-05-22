export interface ProductVariant {
  readonly id: number;
  readonly sku: string | null;
  readonly label: string;
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly pixPriceCents: number | null;
  readonly stock: number;
  readonly available: boolean;
  readonly imageUrl: string | null;
}

export interface ProductCategory {
  readonly name: string;
  readonly slug: string;
  readonly url: string;
}

export interface Product {
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly imageUrls: readonly string[];
  readonly category: ProductCategory | null;
  readonly variants: readonly ProductVariant[];
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly pixPriceCents: number | null;
  readonly totalStock: number;
  readonly available: boolean;
  readonly importedAt: string;
}

export interface CategorySummary {
  readonly name: string;
  readonly slug: string;
  readonly url: string;
  readonly productCount: number;
  readonly availableCount: number;
}

export interface CartItem {
  readonly productSlug: string;
  readonly productName: string;
  readonly variantId: number;
  readonly variantLabel: string;
  readonly unitPriceCents: number;
  readonly imageUrl: string | null;
  readonly quantity: number;
}
