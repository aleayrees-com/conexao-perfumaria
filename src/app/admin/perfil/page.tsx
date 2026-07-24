import { PasswordField } from '@/components/admin/password-field';
import { requireAdmin } from '@/lib/admin-auth';

import { updateOwnAdminPasswordAction } from './actions';

export const metadata = {
  title: 'Minha conta | Conexão Admin',
};

export default async function AdminProfilePage() {
  const actor = await requireAdmin();

  return (
    <main className="admin-page admin-profile-page">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Conta individual</p>
          <h1>Minha conta</h1>
          <span>
            {actor.displayName} · {actor.email}
          </span>
        </div>
      </header>
      <form
        className="admin-panel admin-profile-form"
        action={updateOwnAdminPasswordAction}
      >
        <div className="admin-panel-header">
          <div>
            <p>Segurança</p>
            <h2>Atualizar senha</h2>
          </div>
        </div>
        <PasswordField
          autoComplete="current-password"
          label="Senha atual"
          name="currentPassword"
          required
        />
        <PasswordField
          autoComplete="new-password"
          label="Nova senha"
          maxLength={15}
          minLength={8}
          name="nextPassword"
          required
        />
        <PasswordField
          autoComplete="new-password"
          label="Confirmar nova senha"
          maxLength={15}
          minLength={8}
          name="passwordConfirmation"
          required
        />
        <p className="admin-field-note">
          Use 8 a 15 caracteres, com letras, número e símbolo.
        </p>
        <button className="admin-primary-button" type="submit">
          Salvar nova senha
        </button>
      </form>
    </main>
  );
}
