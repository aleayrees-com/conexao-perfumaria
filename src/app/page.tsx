import Link from 'next/link';

import { ProductCard } from '@/components/product-card';
import { PromoCarousel, type PromoSlide } from '@/components/promo-carousel';
import { SectionHeading, StoreSection } from '@/components/store-layout';
import {
  getCategorySummaries,
  getFeaturedProducts,
  getProducts,
} from '@/lib/catalog';
import { formatMoney } from '@/lib/money';
import type { Product } from '@/types/catalog';

export const revalidate = 60;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function productMatchesTerms(
  product: Product,
  terms: readonly string[],
): boolean {
  const searchable = normalizeText(
    [
      product.name,
      product.description,
      product.category?.name ?? '',
      product.category?.slug ?? '',
    ].join(' '),
  );

  return terms.some((term) => searchable.includes(normalizeText(term)));
}

function pickBannerProducts({
  fallbackProducts,
  products,
  terms,
}: {
  readonly fallbackProducts: readonly Product[];
  readonly products: readonly Product[];
  readonly terms: readonly string[];
}): readonly Product[] {
  const matchedProducts = products.filter(
    (product) => product.imageUrls[0] && productMatchesTerms(product, terms),
  );
  const baseProducts =
    matchedProducts.length > 0 ? matchedProducts : fallbackProducts;

  return baseProducts.filter((product) => product.imageUrls[0]).slice(0, 2);
}

function getMinimumPrice(products: readonly Product[]): number | null {
  const prices = products
    .map((product) => product.priceCents)
    .filter((price) => price > 0);

  return prices.length > 0 ? Math.min(...prices) : null;
}

function toPromoSlideProduct(product: Product) {
  return {
    imageUrl: product.imageUrls[0] ?? '',
    name: product.name,
    slug: product.slug,
  };
}

function buildPromoSlides(
  products: readonly Product[],
  featuredProducts: readonly Product[],
): readonly PromoSlide[] {
  const fallbackProducts = featuredProducts.filter(
    (product) => product.imageUrls[0],
  );
  const slideInputs = [
    {
      id: 'perfumaria',
      bracket: 'perfumaria',
      title: 'perfume de presenca',
      tagline: 'fragrancias marcantes, escolhidas para voce acertar sem duvida',
      searchLabel: 'comprar agora',
      searchHref: '/produtos?busca=perfume',
      terms: ['perfume', 'perfumaria', 'parfum', 'arabes', 'arabe'],
    },
    {
      id: 'body-splash',
      bracket: 'body splash',
      title: 'cheiro bom todo dia',
      tagline:
        'body splash, hidratantes e combinacoes para uma rotina perfumada',
      searchLabel: 'ver favoritos',
      searchHref: '/produtos?busca=body%20splash',
      terms: ['body splash', 'splash', 'dream brand'],
    },
    {
      id: 'kits',
      bracket: 'kits especiais',
      title: 'presente sem erro',
      tagline: 'kits elegantes para impressionar com pronta entrega',
      searchLabel: 'escolher kit',
      searchHref: '/produtos?busca=kit',
      terms: ['kit', 'combo', 'hidratante', 'presente'],
    },
  ] as const;

  return slideInputs.map((slideInput) => {
    const slideProducts = pickBannerProducts({
      fallbackProducts,
      products,
      terms: slideInput.terms,
    });
    const minimumPrice = getMinimumPrice(slideProducts);

    return {
      id: slideInput.id,
      kicker: 'Conexao Perfumaria',
      title: slideInput.title,
      bracket: slideInput.bracket,
      tagline: slideInput.tagline,
      searchLabel: slideInput.searchLabel,
      searchHref: slideInput.searchHref,
      priceLabel: minimumPrice ? formatMoney(minimumPrice) : 'consultar',
      priceDetail: 'Atendimento confirma estoque, frete e pagamento',
      products: slideProducts.map(toPromoSlideProduct),
    };
  });
}

export default async function HomePage() {
  const [products, featuredProducts, categorySummaries] = await Promise.all([
    getProducts(),
    getFeaturedProducts(16),
    getCategorySummaries(),
  ]);
  const categories = categorySummaries.slice(0, 8);
  const promoSlides = buildPromoSlides(products, featuredProducts);

  return (
    <>
      <PromoCarousel slides={promoSlides} />

      <section className="promise-strip" aria-label="Vantagens">
        <article>
          <span>01</span>
          <strong>Escolha com seguranca</strong>
          <p>
            A equipe ajuda a encontrar a fragrancia certa para voce ou presente.
          </p>
        </article>
        <article>
          <span>02</span>
          <strong>Pronta entrega real</strong>
          <p>Produtos selecionados para sair rapido, sem esperar semanas.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Compra assistida</strong>
          <p>Voce confirma tudo no WhatsApp antes de finalizar o pagamento.</p>
        </article>
      </section>

      <StoreSection variant="featured">
        <SectionHeading
          actionHref="/produtos"
          actionLabel="Ver tudo"
          eyebrow="16 favoritos da semana"
          title="queridinhos para comprar hoje"
        />
        <div className="product-grid">
          {featuredProducts.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              variant="editorial"
            />
          ))}
        </div>
      </StoreSection>

      <StoreSection muted>
        <SectionHeading eyebrow="Categorias" title="Compre pelo seu momento" />
        <div className="category-grid">
          {categories.map((category) => (
            <Link
              className="category-card"
              href={`/categoria/${category.slug}`}
              key={category.slug}
            >
              <span>{category.availableCount} pronta entrega</span>
              <strong>{category.name}</strong>
              <small>{category.productCount} produtos</small>
            </Link>
          ))}
        </div>
      </StoreSection>
    </>
  );
}
