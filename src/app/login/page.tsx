import Image from 'next/image';

import { isInitialAdminSetupAvailable } from '@/lib/admin-auth';

import { loginAdminAction, setupInitialAdminAction } from './actions';

export const metadata = {
  title: 'Entrar | Conexão Admin',
  description: 'Acesso administrativo individual da Conexão Perfumaria.',
};

interface LoginPageProps {
  readonly searchParams?: Promise<{
    readonly error?: string;
    readonly next?: string;
    readonly setup?: string;
  }>;
}

function getLoginError(error: string | undefined): string | null {
  if (error === 'rate') {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }

  if (error === 'password') {
    return 'Revise a senha: use 8 a 15 caracteres, letras, número e símbolo.';
  }

  if (error === '1' || error === 'setup') {
    return 'Não foi possível confirmar este acesso. Revise os dados e tente novamente.';
  }

  return null;
}

function LoginBrand(): React.ReactElement {
  return (
    <div className="admin-login-brand">
      <span aria-hidden="true">C</span>
      <div>
        <strong>Conexão Admin</strong>
        <small>Perfumaria • Operação interna</small>
      </div>
    </div>
  );
}

function LoginVisual(): React.ReactElement {
  return (
    <section className="admin-login-hero">
      <LoginBrand />
      <div className="admin-login-copy">
        <p>Controle olfativo</p>
        <h1>Onde a operação encontra a essência.</h1>
        <span>
          Produtos, estoque e vendas organizados para quem cuida da loja todos
          os dias.
        </span>
      </div>
      <div className="admin-login-visual" aria-hidden="true">
        <span className="admin-login-visual-label">Eau de parfum</span>
        <Image
          alt=""
          className="admin-login-fragrance"
          height={900}
          priority
          src="/brand/category-cutouts/arabes.png"
          width={900}
        />
      </div>
      <div className="admin-login-highlights" aria-label="Recursos do painel">
        <span>Catálogo em tempo real</span>
        <span>Histórico por pessoa</span>
        <span>Acesso protegido</span>
      </div>
    </section>
  );
}

function InitialAdminForm({
  error,
  next,
}: {
  readonly error: string | null;
  readonly next: string;
}): React.ReactElement {
  return (
    <form className="login-card" action={setupInitialAdminAction}>
      <input name="next" type="hidden" value={next} />
      <div>
        <p>Configuração única</p>
        <h2>Ativar primeiro acesso</h2>
        <span>Crie o acesso do responsável pela operação da loja.</span>
      </div>
      <label>
        Nome
        <input autoComplete="name" name="displayName" required type="text" />
      </label>
      <label>
        E-mail
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        Nova senha
        <input
          autoComplete="new-password"
          maxLength={15}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      <label>
        Confirmar senha
        <input
          autoComplete="new-password"
          maxLength={15}
          minLength={8}
          name="passwordConfirmation"
          required
          type="password"
        />
      </label>
      <label>
        Código de ativação
        <input name="deploymentSecret" required type="password" />
      </label>
      {error ? <p className="admin-login-error">{error}</p> : null}
      <button className="button" type="submit">
        Criar acesso seguro
      </button>
    </form>
  );
}

function AdminLoginForm({
  error,
  next,
}: {
  readonly error: string | null;
  readonly next: string;
}): React.ReactElement {
  return (
    <form className="login-card" action={loginAdminAction}>
      <input name="next" type="hidden" value={next} />
      <div>
        <p>Acesso individual</p>
        <h2>Bem-vindo de volta</h2>
        <span>Entre com seu e-mail e sua senha administrativa.</span>
      </div>
      <label>
        E-mail
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        Senha
        <input
          autoComplete="current-password"
          name="password"
          required
          type="password"
        />
      </label>
      <p className="admin-login-session">
        Este dispositivo será lembrado por 8 dias.
      </p>
      {error ? <p className="admin-login-error">{error}</p> : null}
      <button className="button" type="submit">
        Entrar no painel
      </button>
      <span className="admin-login-help">
        Sem acesso? Peça ao responsável da Conexão para criar sua conta.
      </span>
    </form>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  let canSetUp = false;

  try {
    canSetUp = await isInitialAdminSetupAvailable();
  } catch {
    // The page stays fail-closed while the production database is unavailable.
    canSetUp = false;
  }
  const error = getLoginError(resolvedSearchParams?.error);
  const next = resolvedSearchParams?.next ?? '/admin';

  return (
    <main className="admin-login-screen">
      <section className="admin-login-panel">
        {canSetUp ? (
          <InitialAdminForm error={error} next={next} />
        ) : (
          <AdminLoginForm error={error} next={next} />
        )}
      </section>
      <LoginVisual />
    </main>
  );
}
