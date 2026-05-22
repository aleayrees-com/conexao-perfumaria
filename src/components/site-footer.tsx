import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="eyebrow">Operacao independente</p>
        <h2>O perfume continua. O bloqueio nao manda na loja.</h2>
      </div>
      <div>
        <Link href="/produtos">Ver catalogo</Link>
        <a href="https://instagram.com/conexao_perfumaria" target="_blank">
          Instagram
        </a>
        <a href="https://wa.me/555521981024555" target="_blank">
          WhatsApp
        </a>
      </div>
    </footer>
  );
}
