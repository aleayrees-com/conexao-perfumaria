import Image from 'next/image';
import Link from 'next/link';

import { CartButton } from '@/components/cart-button';

export function SiteHeader() {
  return (
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
      <nav aria-label="Navegacao principal">
        <Link href="/produtos">Catalogo</Link>
        <Link href="/checkout">Checkout rapido</Link>
        <Link href="/contato">Contato</Link>
      </nav>
      <CartButton />
    </header>
  );
}
