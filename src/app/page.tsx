import Link from 'next/link';

import { ProductCard } from '@/components/product-card';
import {
  getAvailableProducts,
  getCategorySummaries,
  getFeaturedProducts,
  getProducts,
} from '@/lib/catalog';
import { formatMoney } from '@/lib/money';

export const revalidate = 60;

export default async function HomePage() {
  const [products, availableProducts, featuredProducts, categorySummaries] =
    await Promise.all([
      getProducts(),
      getAvailableProducts(),
      getFeaturedProducts(8),
      getCategorySummaries(),
    ]);
  const categories = categorySummaries.slice(0, 8);
  const minimumPrice = Math.min(
    ...products
      .map((product) => product.priceCents)
      .filter((price) => price > 0),
  );

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Catalogo independente no ar</p>
          <h1>Perfume bom nao espera plataforma resolver boleto.</h1>
          <p>
            A Conexao segue vendendo: escolha seu produto, monte o carrinho e
            finalize direto no WhatsApp com confirmacao humana de estoque, frete
            e PIX.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/produtos">
              Comprar agora
            </Link>
            <a
              className="button ghost"
              href="https://wa.me/555521981024555"
              target="_blank"
            >
              Chamar a loja
            </a>
          </div>
        </div>
        <div className="hero-panel" aria-label="Resumo do catalogo">
          <div className="orbital-card">
            <span>Operacao</span>
            <strong>anti-bloqueio</strong>
          </div>
          <div className="hero-metric">
            <span>Produtos importados</span>
            <strong>{products.length}</strong>
          </div>
          <div className="hero-metric">
            <span>Pronta entrega</span>
            <strong>{availableProducts.length}</strong>
          </div>
          <div className="hero-metric">
            <span>A partir de</span>
            <strong>
              {Number.isFinite(minimumPrice)
                ? formatMoney(minimumPrice)
                : 'R$0,00'}
            </strong>
          </div>
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
