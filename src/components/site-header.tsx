import Image from 'next/image';
import Link from 'next/link';

import { CartButton } from '@/components/cart-button';

export function SiteHeader() {
  return (
    <div className="site-chrome">
      <div className="top-announcement">
        <span>Use o cupom BEMVINDO e ganhe 3% de desconto</span>
        <Link href="/produtos?disponivel=1">Ver pronta entrega</Link>
      </div>
      <header className="site-header">
        <form className="site-search" action="/produtos">
          <label className="sr-only" htmlFor="site-search-input">
            Buscar produto
          </label>
          <input
            id="site-search-input"
            name="busca"
            placeholder="Buscar"
            type="search"
          />
          <button type="submit">Buscar</button>
        </form>
        <Link className="brand" href="/" aria-label="Conexao Perfumaria">
          <Image
            alt=""
            height={321}
            priority
            src="/brand/conexao-wordmark-lettering.png"
            width={859}
          />
        </Link>
        <div className="header-actions">
          <Link href="/contato">WhatsApp</Link>
          <Link href="/checkout">Pedido</Link>
          <CartButton />
        </div>
      </header>
      <nav className="category-nav" aria-label="Categorias principais">
        <Link href="/">Inicio</Link>
        <Link href="/categoria/perfumes-arabes">Perfumes Arabes</Link>
        <Link href="/categoria/arabic-collection">Arabic Collection</Link>
        <Link href="/produtos?busca=15ml">Perfume 15ml</Link>
        <Link href="/categoria/hidrat-isabelle-la-belle">Hidratantes</Link>
        <Link href="/produtos?busca=victoria">Victoria&apos;s Secret</Link>
        <Link href="/contato">Como Comprar</Link>
      </nav>
    </div>
  );
}
