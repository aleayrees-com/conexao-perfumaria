import Link from 'next/link';

import { PageHeading, PageShell } from '@/components/store-layout';

export const metadata = {
  title: 'Login',
  description: 'Acesso administrativo da Conexao Perfumaria.',
};

export default function LoginPage() {
  return (
    <PageShell>
      <PageHeading
        eyebrow="Painel em preparacao"
        title="Area interna em construcao"
      >
        <p>
          Em breve a equipe tera acesso a produtos, pedidos e estoque por aqui.
        </p>
      </PageHeading>
      <div className="empty-state wide">
        <p>
          Por enquanto, a loja publica segue funcionando e o acesso interno
          entra na proxima etapa.
        </p>
        <Link className="button" href="/">
          Voltar para a loja
        </Link>
      </div>
    </PageShell>
  );
}
