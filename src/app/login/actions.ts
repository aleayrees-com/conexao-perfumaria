'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  createInitialAdmin,
  signInAdmin,
  signOutAdmin,
} from '@/lib/admin-auth';
import { getAdminPasswordError } from '@/lib/admin-password';
import { checkRateLimit, readClientIp } from '@/lib/request-guard';

function readLoginField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readAdminNextPath(formData: FormData): string {
  const next = readLoginField(formData, 'next');

  return next.startsWith('/admin') ? next : '/admin';
}

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

  const password = readLoginField(formData, 'password');
  const email = readLoginField(formData, 'email');
  const signedIn = await signInAdmin(email, password);

  if (!signedIn) {
    redirect('/login?error=1');
  }

  redirect(readAdminNextPath(formData));
}

export async function setupInitialAdminAction(
  formData: FormData,
): Promise<void> {
  const headerStore = await headers();
  const rateLimit = checkRateLimit({
    key: `admin-setup:${readClientIp(headerStore)}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    redirect('/login?setup=1&error=rate');
  }

  const password = readLoginField(formData, 'password');
  const passwordError = getAdminPasswordError(password);

  if (
    passwordError ||
    password !== readLoginField(formData, 'passwordConfirmation')
  ) {
    redirect('/login?setup=1&error=password');
  }

  try {
    await createInitialAdmin(
      {
        displayName: readLoginField(formData, 'displayName'),
        email: readLoginField(formData, 'email'),
        password,
        role: 'owner',
      },
      readLoginField(formData, 'deploymentSecret'),
    );
  } catch {
    redirect('/login?setup=1&error=setup');
  }

  redirect(readAdminNextPath(formData));
}

export async function logoutAdminAction(): Promise<void> {
  await signOutAdmin();
  redirect('/login');
}
