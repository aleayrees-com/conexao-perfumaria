'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { signInAdmin, signOutAdmin } from '@/lib/admin-auth';
import { checkRateLimit, readClientIp } from '@/lib/request-guard';

export async function loginAdminAction(formData: FormData): Promise<void> {
  const headerStore = await headers();
  const rateLimit = checkRateLimit({
    key: `admin-login:${readClientIp(headerStore)}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    redirect('/login?error=rate');
  }

  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/admin');
  const signedIn = await signInAdmin(password);

  if (!signedIn) {
    redirect('/login?error=1');
  }

  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function logoutAdminAction(): Promise<void> {
  await signOutAdmin();
  redirect('/login');
}
