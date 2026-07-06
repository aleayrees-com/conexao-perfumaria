import { PageHeading, PageShell } from '@/components/store-layout';

import { loginAdminAction } from './actions';

export const metadata = {
  title: 'Login',
  description: 'Acesso administrativo da Conexão Perfumaria.',
};

interface LoginPageProps {
  readonly searchParams?: Promise<{
    readonly error?: string;
    readonly next?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <PageShell>
      <PageHeading
        eyebrow="Area administrativa"
        title="Entrar no painel da Conexão"
      >
        <p>
          Acesso protegido para cuidar de produtos, estoque, pedidos e
          conversoes.
        </p>
      </PageHeading>
      <form className="login-card" action={loginAdminAction}>
        <input
          name="next"
          type="hidden"
          value={resolvedSearchParams?.next ?? '/admin'}
        />
        <label>
          Senha administrativa
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        {resolvedSearchParams?.error === 'rate' ? (
          <p className="checkout-error">
            Muitas tentativas. Aguarde alguns minutos e tente novamente.
          </p>
        ) : null}
        {resolvedSearchParams?.error === '1' ? (
          <p className="checkout-error">Senha invalida.</p>
        ) : null}
        <button className="button" type="submit">
          Entrar
        </button>
      </form>
    </PageShell>
  );
}
