'use server';

import { redirect } from 'next/navigation';

import {
  canManageAdminAccounts,
  getAdminAccessPasswordError,
  type AdminRole,
} from '@/lib/admin-access';
import {
  createAdminAccount,
  requireAdmin,
  setAdminAccountActivity,
} from '@/lib/admin-auth';
import { createAdminClient, insertAdminAuditLog } from '@/lib/admin-data';

export interface CreateAdminAccountState {
  readonly error: string | null;
}

function readAccessField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function requireAccountOwner(role: AdminRole): void {
  if (!canManageAdminAccounts(role)) {
    throw new Error('Somente a conta proprietária pode administrar acessos.');
  }
}

function readAccountRole(value: string): AdminRole {
  return value === 'admin' ? 'admin' : 'operator';
}

export async function createAdminAccountAction(
  _previousState: CreateAdminAccountState,
  formData: FormData,
): Promise<CreateAdminAccountState> {
  const actor = await requireAdmin();
  requireAccountOwner(actor.role);
  const password = readAccessField(formData, 'password');
  const passwordError = getAdminAccessPasswordError(
    password,
    readAccessField(formData, 'passwordConfirmation'),
  );

  if (passwordError) {
    return { error: passwordError };
  }

  let profile;

  try {
    profile = await createAdminAccount({
      displayName: readAccessField(formData, 'displayName'),
      email: readAccessField(formData, 'email'),
      password,
      role: readAccountRole(readAccessField(formData, 'role')),
    });
  } catch {
    return {
      error:
        'Não foi possível criar este acesso. Confira os dados e use um e-mail ainda não cadastrado.',
    };
  }

  const client = createAdminClient();
  await insertAdminAuditLog(client, {
    actor,
    action: 'admin_account_created',
    entityType: 'admin_profiles',
    entityId: profile.id,
    metadata: { createdEmail: profile.email, createdName: profile.displayName },
  });
  redirect('/admin/acessos?created=1');
}

export async function updateAdminAccountActivityAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireAdmin();
  requireAccountOwner(actor.role);
  const email = readAccessField(formData, 'email').toLowerCase();
  const isActive = readAccessField(formData, 'isActive') === 'true';

  if (!isActive && email === actor.email) {
    throw new Error('A conta proprietária não pode desativar a si mesma.');
  }

  const profile = await setAdminAccountActivity(email, isActive);

  if (!profile) {
    throw new Error(`A conta "${email}" não foi encontrada.`);
  }

  await insertAdminAuditLog(createAdminClient(), {
    actor,
    action: isActive ? 'admin_account_enabled' : 'admin_account_disabled',
    entityType: 'admin_profiles',
    entityId: profile.id,
    metadata: { targetEmail: profile.email, targetName: profile.displayName },
  });
  redirect('/admin/acessos?updated=1');
}
