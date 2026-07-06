import { notFound } from 'next/navigation';

import { ProductCard } from '@/components/product-card';
import { PageHeading, PageShell } from '@/components/store-layout';
import {
  getCategoryBySlug,
  getCategorySummaries,
  getProductsByCategory,
} from '@/lib/catalog';
import { formatPortugueseDisplayText } from '@/lib/strings';

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
    <PageShell>
      <PageHeading
        eyebrow="Categoria"
        title={formatPortugueseDisplayText(category.name)}
      >
        <p>
          {category.productCount} produtos, {category.availableCount} em pronta
          entrega.
        </p>
      </PageHeading>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </PageShell>
  );
}
