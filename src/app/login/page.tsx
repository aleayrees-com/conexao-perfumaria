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
  const errorMessage =
    resolvedSearchParams?.error === 'rate'
      ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      : resolvedSearchParams?.error === '1'
        ? 'Senha inválida. Confira o acesso administrativo.'
        : null;

  return (
    <main className="admin-login-screen">
      <section className="admin-login-panel" aria-label="Login administrativo">
        <form className="login-card" action={loginAdminAction}>
          <input
            name="next"
            type="hidden"
            value={resolvedSearchParams?.next ?? '/admin'}
          />
          <div>
            <p>Acesso seguro</p>
            <h2>Bem-vindo de volta</h2>
            <span>Use a senha administrativa para continuar.</span>
          </div>
          <label>
            Senha administrativa
            <input
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </label>
          {errorMessage ? (
            <p className="checkout-error admin-login-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button className="button" type="submit">
            Entrar no painel
          </button>
        </form>
      </section>

      <section className="admin-login-hero" aria-labelledby="admin-login-title">
        <div className="admin-login-brand">
          <span>CP</span>
          <div>
            <strong>Conexão Admin</strong>
            <small>Operação da loja</small>
          </div>
        </div>

        <div className="admin-login-copy">
          <p>Área administrativa</p>
          <h1 id="admin-login-title">Entrar no painel da Conexão</h1>
          <span>
            Controle produtos, valores, estoque, pedidos e conversões em um
            ambiente protegido.
          </span>
        </div>

        <div className="admin-login-highlights" aria-label="Áreas do painel">
          <span>Produtos</span>
          <span>Valores</span>
          <span>Estoque</span>
          <span>Pedidos</span>
        </div>
      </section>
    </main>
  );
}
