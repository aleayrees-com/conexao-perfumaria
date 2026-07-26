'use client';

import { useActionState, useState, type ReactElement } from 'react';

import {
  createAdminAccountAction,
  type CreateAdminAccountState,
} from '@/app/admin/acessos/actions';
import { PasswordField } from '@/components/admin/password-field';

interface AdminAccessDraft {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly passwordConfirmation: string;
  readonly role: 'admin' | 'operator';
}

interface AdminAccessFormProps {
  readonly canCreateAccount: boolean;
  readonly initialError: string | null;
}

const EMPTY_ADMIN_ACCESS_DRAFT: AdminAccessDraft = {
  displayName: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  role: 'operator',
};

function getInitialActionState(error: string | null): CreateAdminAccountState {
  return { error };
}

export function AdminAccessForm({
  canCreateAccount,
  initialError,
}: AdminAccessFormProps): ReactElement {
  const [draft, setDraft] = useState(EMPTY_ADMIN_ACCESS_DRAFT);
  const [state, formAction, isPending] = useActionState(
    createAdminAccountAction,
    getInitialActionState(initialError),
  );

  function updateDraft<Key extends keyof AdminAccessDraft>(
    key: Key,
    value: AdminAccessDraft[Key],
  ): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className="admin-panel admin-access-form" action={formAction}>
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
          onChange={(event) => updateDraft('displayName', event.target.value)}
          required
          type="text"
          value={draft.displayName}
        />
      </label>
      <label>
        E-mail
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => updateDraft('email', event.target.value)}
          required
          type="email"
          value={draft.email}
        />
      </label>
      <label>
        Tipo de acesso
        <select
          name="role"
          onChange={(event) =>
            updateDraft('role', event.target.value as AdminAccessDraft['role'])
          }
          value={draft.role}
        >
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
        onChange={(event) => updateDraft('password', event.target.value)}
        required
        value={draft.password}
      />
      <PasswordField
        autoComplete="new-password"
        label="Confirmar senha"
        maxLength={15}
        minLength={8}
        name="passwordConfirmation"
        onChange={(event) =>
          updateDraft('passwordConfirmation', event.target.value)
        }
        required
        value={draft.passwordConfirmation}
      />
      <p className="admin-field-note">
        {canCreateAccount
          ? 'De 8 a 15 caracteres, com letras maiúsculas e minúsculas, número e símbolo.'
          : 'Limite de 3 acessos atingido. Nenhuma quarta conta pode ser criada.'}
      </p>
      {state.error ? (
        <p className="admin-access-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        className="admin-primary-button"
        disabled={!canCreateAccount || isPending}
        type="submit"
      >
        {isPending
          ? 'Criando acesso…'
          : canCreateAccount
            ? 'Criar acesso'
            : 'Limite de acessos atingido'}
      </button>
    </form>
  );
}
