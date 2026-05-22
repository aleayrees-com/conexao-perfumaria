import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="page-shell not-found-page">
      <div className="page-heading">
        <p className="eyebrow">404</p>
        <h1>Essa rota nao esta no frasco.</h1>
        <p>
          A pagina nao existe ou ainda nao foi criada. A loja continua de pe:
          catalogo, carrinho e checkout rapido seguem funcionando.
        </p>
      </div>
      <div className="hero-actions">
        <Link className="button" href="/produtos">
          Abrir catalogo
        </Link>
        <Link className="button ghost" href="/">
          Voltar ao inicio
        </Link>
      </div>
    </section>
  );
}
