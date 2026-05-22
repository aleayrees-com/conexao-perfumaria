import { notFound } from 'next/navigation';

import { ProductCard } from '@/components/product-card';
import {
  getCategoryBySlug,
  getCategorySummaries,
  getProductsByCategory,
} from '@/lib/catalog';

interface CategoryPageProps {
  readonly params: Promise<{
    readonly slug: string;
  }>;
}

export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCategorySummaries()).map((category) => ({
    slug: category.slug,
  }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(category.slug);

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Categoria</p>
        <h1>{category.name}</h1>
        <p>
          {category.productCount} produtos, {category.availableCount} em pronta
          entrega.
        </p>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}
