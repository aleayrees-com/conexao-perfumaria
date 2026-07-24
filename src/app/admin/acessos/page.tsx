import { redirect } from 'next/navigation';

import {
  canCreateAdminAccount,
  canManageAdminAccounts,
} from '@/lib/admin-access';
import { PasswordField } from '@/components/admin/password-field';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminProfiles } from '@/lib/admin-data';

import {
  createAdminAccountAction,
  updateAdminAccountActivityAction,
} from './actions';

export const metadata = {
  title: 'Acessos | Conexão Admin',
};

export default async function AdminAccessPage() {
  const actor = await requireAdmin();

  if (!canManageAdminAccounts(actor.role)) {
    redirect('/admin');
  }

  const profiles = await listAdminProfiles();
  const canCreateAccount = canCreateAdminAccount(profiles.length);

  return (
    <main className="admin-page admin-access-page">
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Segurança da operação</p>
          <h1>Acessos da equipe</h1>
          <span>
            Contas individuais, com bloqueio imediato e histórico por pessoa.
          </span>
        </div>
      </header>

      <section className="admin-access-layout">
        <form
          className="admin-panel admin-access-form"
          action={createAdminAccountAction}
        >
          <div className="admin-panel-header">
            <div>
              <p>Novo acesso</p>
              <h2>Adicionar pessoa</h2>
            </div>
          </div>
          <label>
            Nome
            <input
              autoComplete="name"
              name="displayName"
              required
              type="text"
            />
          </label>
          <label>
            E-mail
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            Tipo de acesso
            <select defaultValue="operator" name="role">
              <option value="operator">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <PasswordField
            autoComplete="new-password"
            label="Senha temporária"
            maxLength={15}
            minLength={8}
            name="password"
            required
          />
          <PasswordField
            autoComplete="new-password"
            label="Confirmar senha"
            maxLength={15}
            minLength={8}
            name="passwordConfirmation"
            required
          />
          <p className="admin-field-note">
            {canCreateAccount
              ? 'De 8 a 15 caracteres, com letras maiúsculas e minúsculas, número e símbolo.'
              : 'Limite de 3 acessos atingido. Nenhuma quarta conta pode ser criada.'}
          </p>
          <button
            className="admin-primary-button"
            disabled={!canCreateAccount}
            type="submit"
          >
            {canCreateAccount ? 'Criar acesso' : 'Limite de acessos atingido'}
          </button>
        </form>

        <section
          className="admin-panel admin-access-list"
          aria-labelledby="admin-access-list-title"
        >
          <div className="admin-panel-header">
            <div>
              <p>Equipe autorizada</p>
              <h2 id="admin-access-list-title">{profiles.length} conta(s)</h2>
            </div>
          </div>
          <div className="admin-access-rows">
            {profiles.map((profile) => (
              <article className="admin-access-row" key={profile.id}>
                <div className="admin-access-avatar" aria-hidden="true">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{profile.displayName}</strong>
                  <span>{profile.email}</span>
                </div>
                <span
                  className={
                    profile.isActive
                      ? 'admin-status-active'
                      : 'admin-status-archived'
                  }
                >
                  {profile.isActive ? 'Ativo' : 'Desativado'}
                </span>
                <form action={updateAdminAccountActivityAction}>
                  <input name="email" type="hidden" value={profile.email} />
                  <input
                    name="isActive"
                    type="hidden"
                    value={String(!profile.isActive)}
                  />
                  <button className="admin-ghost-button" type="submit">
                    {profile.isActive ? 'Desativar' : 'Reativar'}
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
