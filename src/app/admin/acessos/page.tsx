import { redirect } from 'next/navigation';

import {
  canCreateAdminAccount,
  canManageAdminAccounts,
  getAdminAccessErrorMessage,
} from '@/lib/admin-access';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminProfiles } from '@/lib/admin-data';
import { AdminAccessForm } from '@/components/admin/admin-access-form';

import { updateAdminAccountActivityAction } from './actions';

export const metadata = {
  title: 'Acessos | Conexão Admin',
};

interface AdminAccessPageProps {
  readonly searchParams?: Promise<{
    readonly error?: string;
  }>;
}

export default async function AdminAccessPage({
  searchParams,
}: AdminAccessPageProps) {
  const actor = await requireAdmin();

  if (!canManageAdminAccounts(actor.role)) {
    redirect('/admin');
  }

  const profiles = await listAdminProfiles();
  const canCreateAccount = canCreateAdminAccount(profiles.length);
  const resolvedSearchParams = await searchParams;
  const error = getAdminAccessErrorMessage(resolvedSearchParams?.error);

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
        <AdminAccessForm
          canCreateAccount={canCreateAccount}
          initialError={error}
        />

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
