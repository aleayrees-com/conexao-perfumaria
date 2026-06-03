import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="eyebrow">Conexao Perfumaria</p>
        <h2>Seu proximo perfume favorito esta mais perto.</h2>
      </div>
      <div className="footer-links">
        <Link href="/produtos">Catalogo</Link>
        <Link href="/contato">Endereco da loja</Link>
        <a
          href="https://wa.me/555521981024555"
          rel="noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
        <a
          href="https://instagram.com/conexao_perfumaria"
          rel="noreferrer"
          target="_blank"
        >
          Instagram
        </a>
        <Link href="/contato">Entregas e envios</Link>
      </div>
    </footer>
  );
}
