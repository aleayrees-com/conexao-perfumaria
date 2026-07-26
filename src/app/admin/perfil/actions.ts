'use server';

import { redirect } from 'next/navigation';

import { requireAdmin, updateAdminPassword } from '@/lib/admin-auth';
import { createAdminClient, insertAdminAuditLog } from '@/lib/admin-data';
import { getAdminPasswordError } from '@/lib/admin-password';

function readProfileField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function updateOwnAdminPasswordAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireAdmin();
  const nextPassword = readProfileField(formData, 'nextPassword');
  const passwordError = getAdminPasswordError(nextPassword);

  if (
    passwordError ||
    nextPassword !== readProfileField(formData, 'passwordConfirmation')
  ) {
    throw new Error(passwordError ?? 'A confirmação de senha não confere.');
  }

  await updateAdminPassword(
    actor,
    readProfileField(formData, 'currentPassword'),
    nextPassword,
  );
  await insertAdminAuditLog(createAdminClient(), {
    actor,
    action: 'admin_password_updated',
    entityType: 'admin_profiles',
    metadata: {},
  });
  redirect('/admin/perfil?updated=1');
}
