import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ADMIN_SESSION_COOKIE = 'conexao-admin-session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface AdminSessionPayload {
  readonly issuedAt: number;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} precisa estar configurado no servidor.`);
  }

  return value;
}

function signPayload(payload: string): string {
  return createHmac('sha256', readRequiredEnv('ADMIN_SESSION_SECRET'))
    .update(payload)
    .digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodeSession(payload: AdminSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );

  return `${body}.${signPayload(body)}`;
}

function decodeSession(value: string): AdminSessionPayload | null {
  const [body, signature] = value.split('.');

  if (!body || !signature || !safeEqual(signature, signPayload(body))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<AdminSessionPayload>;

    if (!parsed.issuedAt || !Number.isFinite(parsed.issuedAt)) {
      return null;
    }

    return { issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}

export async function isAdminSessionValid(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return false;
  }

  const session = decodeSession(token);

  return Boolean(session && Date.now() - session.issuedAt <= SESSION_TTL_MS);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSessionValid())) {
    redirect('/login?next=/admin');
  }
}

export async function signInAdmin(password: string): Promise<boolean> {
  const expectedPassword = readRequiredEnv('ADMIN_PASSWORD');

  if (!safeEqual(password, expectedPassword)) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    encodeSession({ issuedAt: Date.now() }),
    {
      httpOnly: true,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  );

  return true;
}

export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
