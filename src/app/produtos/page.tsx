import { CatalogClient } from '@/components/catalog-client';
import { PageHeading, PageShell } from '@/components/store-layout';
import { getCategorySummaries, getProducts } from '@/lib/catalog';

export const metadata = {
  title: 'Catalogo',
  description:
    'Catalogo completo da Conexao Perfumaria com pedido direto pelo WhatsApp.',
};

export const revalidate = 60;

function parsePriceFilter(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

interface ProductsPageProps {
  readonly searchParams?: Promise<{
    readonly busca?: string;
    readonly disponivel?: string;
    readonly precoMax?: string;
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
  const initialMaxPriceCents = parsePriceFilter(resolvedSearchParams?.precoMax);

  return (
    <PageShell>
      <PageHeading
        eyebrow="Catalogo premium"
        title="Encontre sua fragrancia ideal."
      >
        <p>
          Filtre por categoria, veja os favoritos e monte seu pedido com
          atendimento direto da loja.
        </p>
      </PageHeading>
      <CatalogClient
        categories={categories}
        initialOnlyAvailable={resolvedSearchParams?.disponivel === '1'}
        initialMaxPriceCents={initialMaxPriceCents}
        initialSearchTerm={resolvedSearchParams?.busca ?? ''}
        products={products}
      />
    </PageShell>
  );
}
