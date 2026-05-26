import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="eyebrow">Conexao Perfumaria</p>
        <h2>Seu proximo perfume favorito esta aqui.</h2>
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
