import Image from 'next/image';
import Link from 'next/link';

import { CartButton } from '@/components/cart-button';

export function SiteHeader() {
  return (
    <div className="site-chrome">
      <div className="top-announcement">
        <span>Garanta sua fragrancia favorita com atendimento direto</span>
        <Link href="/contato">Falar com a loja</Link>
      </div>
      <header className="site-header">
        <Link className="brand" href="/">
          <Image
            alt="Conexao Perfumaria"
            height={349}
            priority
            src="/brand/conexao-wordmark.png"
            width={1032}
          />
        </Link>
        <form className="site-search" action="/produtos">
          <label className="sr-only" htmlFor="site-search-input">
            Buscar produto
          </label>
          <input
            id="site-search-input"
            name="busca"
            placeholder="digite aqui o que procura..."
            type="search"
          />
          <button type="submit">Buscar</button>
        </form>
        <div className="header-actions">
          <Link href="/contato">WhatsApp</Link>
          <Link href="/checkout">Checkout</Link>
          <CartButton />
        </div>
      </header>
      <nav className="category-nav" aria-label="Categorias principais">
        <Link href="/produtos?busca=perfume">perfumaria</Link>
        <Link href="/produtos?busca=body%20splash">body splash</Link>
        <Link href="/produtos?busca=kit">kits</Link>
        <Link href="/produtos?busca=hidratante">hidratantes</Link>
        <Link href="/produtos?disponivel=1">pronta entrega</Link>
        <Link href="/contato">atendimento</Link>
      </nav>
    </div>
  );
}
