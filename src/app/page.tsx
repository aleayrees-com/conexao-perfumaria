import Image from 'next/image';
import Link from 'next/link';

import { ProductCard } from '@/components/product-card';
import {
  getCategorySummaries,
  getFeaturedProducts,
  getProducts,
} from '@/lib/catalog';
import { formatMoney } from '@/lib/money';

export const revalidate = 60;

export default async function HomePage() {
  const [products, featuredProducts, categorySummaries] = await Promise.all([
    getProducts(),
    getFeaturedProducts(8),
    getCategorySummaries(),
  ]);
  const categories = categorySummaries.slice(0, 8);
  const bannerProducts = featuredProducts
    .flatMap((product) => {
      const imageUrl = product.imageUrls[0];

      return imageUrl ? [{ imageUrl, product }] : [];
    })
    .slice(0, 5);
  const minimumPrice = Math.min(
    ...products
      .map((product) => product.priceCents)
      .filter((price) => price > 0),
  );

  return (
    <>
      <section className="promo-hero" aria-label="Campanha principal">
        <button
          className="promo-arrow left"
          type="button"
          aria-label="Anterior"
        >
          ‹
        </button>
        <div className="promo-copy">
          <span>Conexao Perfumaria</span>
          <strong>
            promo
            <small>[especial]</small>
          </strong>
          <p>fragrancias com atendimento direto</p>
          <Link className="promo-search" href="/produtos">
            catalogo completo
          </Link>
        </div>
        <div className="promo-stage" aria-label="Produtos em destaque">
          <div className="promo-price">
            <span>a partir de:</span>
            <strong>
              {Number.isFinite(minimumPrice)
                ? formatMoney(minimumPrice)
                : 'consultar'}
            </strong>
            <small>PIX e frete confirmados no WhatsApp</small>
          </div>
          <div className="promo-products">
            {bannerProducts.length > 0 ? (
              bannerProducts.map(({ imageUrl, product }) => (
                <Link
                  className="promo-product"
                  href={`/produtos/${product.slug}`}
                  key={product.slug}
                >
                  <Image
                    alt={product.name}
                    height={320}
                    src={imageUrl}
                    width={240}
                  />
                </Link>
              ))
            ) : (
              <div className="promo-product-empty">
                <span>Conexao</span>
                <strong>catalogo</strong>
              </div>
            )}
          </div>
        </div>
        <button
          className="promo-arrow right"
          type="button"
          aria-label="Proximo"
        >
          ›
        </button>
        <div className="promo-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

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
