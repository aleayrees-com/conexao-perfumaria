import { BulkProductEditor } from '@/components/admin/bulk-product-editor';
import { listAdminCategories, listAdminProducts } from '@/lib/admin-data';

interface BulkProductPageProps {
  readonly searchParams?: Promise<{
    readonly imported?: string;
    readonly updated?: string;
  }>;
}

export default async function BulkProductPage({
  searchParams,
}: BulkProductPageProps) {
  const [products, categories, resolvedSearchParams] = await Promise.all([
    listAdminProducts(),
    listAdminCategories(),
    searchParams,
  ]);
  const updated = resolvedSearchParams?.updated;
  const imported = resolvedSearchParams?.imported;

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Catálogo</p>
          <h1>Valores e estoque em escala</h1>
          <p>
            Selecione produtos, escolha o tipo de ajuste e revise a prévia antes
            de aplicar.
          </p>
        </div>
      </div>

      {updated ? (
        <div className="admin-success-banner">
          {updated} produtos atualizados.
        </div>
      ) : null}
      {imported ? (
        <div className="admin-success-banner">
          CSV importado para {imported} produtos.
        </div>
      ) : null}

      <BulkProductEditor categories={categories} products={products} />
    </section>
  );
}
