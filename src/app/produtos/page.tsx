import { CatalogClient } from '@/components/catalog-client';
import { getCategorySummaries, getProducts } from '@/lib/catalog';

export const metadata = {
  title: 'Catalogo',
  description:
    'Catalogo completo da Conexao Perfumaria com pedido direto pelo WhatsApp.',
};

export const revalidate = 60;

interface ProductsPageProps {
  readonly searchParams?: Promise<{
    readonly busca?: string;
    readonly disponivel?: string;
  }>;
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const [categories, products] = await Promise.all([
    getCategorySummaries(),
    getProducts(),
  ]);

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Catalogo completo</p>
        <h1>Escolha, filtre, mande para o carrinho.</h1>
        <p>
          Busca com debounce, categorias importadas e status de estoque para
          vender sem depender do checkout antigo.
        </p>
      </div>
      <CatalogClient
        categories={categories}
        initialOnlyAvailable={resolvedSearchParams?.disponivel === '1'}
        initialSearchTerm={resolvedSearchParams?.busca ?? ''}
        products={products}
      />
    </section>
  );
}
