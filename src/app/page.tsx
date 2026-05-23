import Link from 'next/link';

import { ProductCard } from '@/components/product-card';
import { PromoCarousel, type PromoSlide } from '@/components/promo-carousel';
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

  return baseProducts.filter((product) => product.imageUrls[0]).slice(0, 5);
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
      tagline: 'descontos exclusivos na categoria',
      searchLabel: 'perfumaria',
      searchHref: '/produtos?busca=perfume',
      terms: ['perfume', 'perfumaria', 'parfum', 'arabes', 'arabe'],
    },
    {
      id: 'body-splash',
      bracket: 'body splash',
      tagline: 'leve, borrife e venda no WhatsApp',
      searchLabel: 'body splashes',
      searchHref: '/produtos?busca=body%20splash',
      terms: ['body splash', 'splash', 'dream brand'],
    },
    {
      id: 'kits',
      bracket: 'kits especiais',
      tagline: 'combos prontos para presente',
      searchLabel: 'kits e combos',
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
      title: 'promo',
      bracket: slideInput.bracket,
      tagline: slideInput.tagline,
      searchLabel: slideInput.searchLabel,
      searchHref: slideInput.searchHref,
      priceLabel: minimumPrice ? formatMoney(minimumPrice) : 'consultar',
      priceDetail: 'PIX, estoque e frete confirmados no WhatsApp',
      products: slideProducts.map(toPromoSlideProduct),
    };
  });
}

export default async function HomePage() {
  const [products, featuredProducts, categorySummaries] = await Promise.all([
    getProducts(),
    getFeaturedProducts(8),
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
          <strong>Pedido sem checkout travado</strong>
          <p>O WhatsApp vira caixa rapido enquanto o gateway novo nao entra.</p>
        </article>
        <article>
          <span>02</span>
          <strong>Catalogo puxado da loja atual</strong>
          <p>
            Produtos, imagens, precos e estoque vieram do Nuvemshop publico.
          </p>
        </article>
        <article>
          <span>03</span>
          <strong>Compra com confirmacao humana</strong>
          <p>
            Menos friccao, mais conversa, sem esconder o que esta acontecendo.
          </p>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <p className="eyebrow">Curadoria quente</p>
          <h2>Produtos para voltar a girar hoje</h2>
          <Link href="/produtos">Ver tudo</Link>
        </div>
        <div className="product-grid">
          {featuredProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      <section className="section muted-section">
        <div className="section-heading">
          <p className="eyebrow">Mapa rapido</p>
          <h2>Categorias que vendem sem pedir licenca</h2>
        </div>
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
      </section>
    </>
  );
}
