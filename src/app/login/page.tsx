import Link from 'next/link';

export const metadata = {
  title: 'Login',
  description: 'Acesso administrativo da Conexao Perfumaria.',
};

export default function LoginPage() {
  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Painel em preparacao</p>
        <h1>O admin vem logo depois do deploy.</h1>
        <p>
          O catalogo ja esta no Supabase. O proximo bloco e transformar isso em
          painel de produtos, pedidos e estoque.
        </p>
      </div>
      <div className="empty-state wide">
        <p>
          Por enquanto, a loja publica segue funcionando e o acesso interno
          entra na proxima etapa.
        </p>
        <Link className="button" href="/">
          Voltar para a loja
        </Link>
      </div>
    </section>
  );
}
