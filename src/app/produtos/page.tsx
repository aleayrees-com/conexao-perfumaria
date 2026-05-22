import { CatalogClient } from '@/components/catalog-client';
import { getCategorySummaries, getProducts } from '@/lib/catalog';

export const metadata = {
  title: 'Catalogo',
  description:
    'Catalogo completo da Conexao Perfumaria com pedido direto pelo WhatsApp.',
};

export const revalidate = 60;

export default async function ProductsPage() {
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
      <CatalogClient categories={categories} products={products} />
    </section>
  );
}
