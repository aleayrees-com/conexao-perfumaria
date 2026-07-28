import { ProductCard } from '@/components/product-card';
import { PageHeading, PageShell } from '@/components/store-layout';
import { getProducts } from '@/lib/catalog';
import { selectComboProducts } from '@/lib/catalog-utils';

export const metadata = {
  title: 'Kits e presentes',
  description: 'Kits e combos da Conexão Perfumaria para presentear.',
};

export const revalidate = 60;

export default async function CombosPage() {
  const products = selectComboProducts(await getProducts());
  const availableCount = products.filter((product) => product.available).length;

  return (
    <PageShell>
      <PageHeading eyebrow="Seleção especial" title="Kits e presentes">
        <p>
          {products.length} opções para presentear, com {availableCount} em
          pronta entrega.
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
