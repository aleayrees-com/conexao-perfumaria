import Link from 'next/link';

import { CartButton } from '@/components/cart-button';

export function SiteHeader() {
  return (
    <div className="site-chrome">
      <div className="top-announcement">
        <span>Pronta entrega, atendimento humano e compra sem enrolacao</span>
        <Link href="/contato">Comprar pelo WhatsApp</Link>
      </div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Conexao Perfumaria">
          <span className="brand-wordmark">CONEXÃO</span>
        </Link>
        <form className="site-search" action="/produtos">
          <label className="sr-only" htmlFor="site-search-input">
            Buscar produto
          </label>
          <input
            id="site-search-input"
            name="busca"
            placeholder="busque perfume, body splash ou presente"
            type="search"
          />
          <button type="submit">Buscar</button>
        </form>
        <div className="header-actions">
          <Link href="/contato">Atendimento VIP</Link>
          <Link href="/checkout">Meu pedido</Link>
          <CartButton />
        </div>
      </header>
      <nav className="category-nav" aria-label="Categorias principais">
        <Link href="/produtos?busca=perfume">perfumes importados</Link>
        <Link href="/produtos?busca=body%20splash">body splash</Link>
        <Link href="/produtos?busca=kit">kits presente</Link>
        <Link href="/produtos?busca=hidratante">hidratantes</Link>
        <Link href="/produtos?disponivel=1">pronta entrega</Link>
        <Link href="/contato">consultoria</Link>
      </nav>
    </div>
  );
}
