import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { unstable_noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { isAdminProfileActive, type AdminRole } from '@/lib/admin-access';
import {
  countAdminProfiles,
  createAdminClient,
  createAdminProfile,
  findAdminProfileByEmail,
  setAdminProfileActivity,
  type AdminProfile,
} from '@/lib/admin-data';
import { ADMIN_SESSION_TTL_MS, isAdminSessionFresh } from '@/lib/admin-session';

const ADMIN_SESSION_COOKIE = 'conexao-admin-session';
const DISABLED_USER_BAN_DURATION = '876000h';

interface AdminSessionPayload {
  readonly email: string;
  readonly issuedAt: number;
}

export interface AdminActor {
  readonly authUserId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AdminRole;
}

export interface NewAdminAccount {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly role: AdminRole;
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

function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
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

  return parseSessionPayload(body);
}

function parseSessionPayload(body: string): AdminSessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<AdminSessionPayload>;

    if (
      !parsed.email ||
      !parsed.issuedAt ||
      !Number.isFinite(parsed.issuedAt)
    ) {
      return null;
    }

    return {
      email: normalizeAdminEmail(parsed.email),
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

function createAdminActor(profile: AdminProfile): AdminActor | null {
  if (!profile.authUserId || !isAdminProfileActive(profile.isActive)) {
    return null;
  }

  return {
    authUserId: profile.authUserId,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
  };
}

async function writeAdminSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const value = encodeSession({ email, issuedAt: Date.now() });

  cookieStore.set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

async function readSessionPayload(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = decodeSession(token);

  return session && isAdminSessionFresh(session.issuedAt, Date.now())
    ? session
    : null;
}

async function provisionAdminAccount(
  input: NewAdminAccount,
): Promise<AdminProfile> {
  const client = createAdminClient();
  const email = normalizeAdminEmail(input.email);
  const response = await client.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });

  if (response.error || !response.data.user) {
    throw new Error(
      `Falha ao criar acesso para "${email}": ${response.error?.message ?? 'usuário ausente'}.`,
    );
  }

  return persistAdminProfile(client, response.data.user.id, input, email);
}

async function persistAdminProfile(
  client: ReturnType<typeof createAdminClient>,
  authUserId: string,
  input: NewAdminAccount,
  email: string,
): Promise<AdminProfile> {
  try {
    return await createAdminProfile(client, {
      authUserId,
      displayName: input.displayName.trim(),
      email,
      isActive: true,
      role: input.role,
    });
  } catch (error: unknown) {
    await client.auth.admin.deleteUser(authUserId);
    throw error;
  }
}

/**
 * Returns the active person attached to the trusted-device session.
 *
 * @example await getSignedInAdmin()
 */
export async function getSignedInAdmin(): Promise<AdminActor | null> {
  unstable_noStore();
  const session = await readSessionPayload();

  if (!session) {
    return null;
  }

  const profile = await findAdminProfileByEmail(
    createAdminClient(),
    session.email,
  );

  return profile ? createAdminActor(profile) : null;
}

/**
 * Checks the trusted-device session and its current access status.
 *
 * @example await isAdminSessionValid()
 */
export async function isAdminSessionValid(): Promise<boolean> {
  return Boolean(await getSignedInAdmin());
}

/**
 * Requires an enabled admin account before opening a protected route.
 *
 * @example const actor = await requireAdmin()
 */
export async function requireAdmin(): Promise<AdminActor> {
  const actor = await getSignedInAdmin();

  if (!actor) {
    redirect('/login?next=/admin');
  }

  return actor;
}

/**
 * Authenticates credentials through Supabase Auth and starts an 8-day session.
 *
 * @example await signInAdmin('operacao@conexao.com', 'senha-segura')
 */
export async function signInAdmin(
  email: string,
  password: string,
): Promise<boolean> {
  const client = createAdminClient();
  const profile = await findAdminProfileByEmail(client, email);

  if (!profile || !createAdminActor(profile)) {
    return false;
  }

  const response = await client.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (response.error || response.data.user?.id !== profile.authUserId) {
    return false;
  }

  await writeAdminSession(profile.email);
  return true;
}

/**
 * Indicates whether the one-time owner setup can still be opened.
 *
 * @example await isInitialAdminSetupAvailable()
 */
export async function isInitialAdminSetupAvailable(): Promise<boolean> {
  return (await countAdminProfiles(createAdminClient())) === 0;
}

/**
 * Creates the first owner after validating the existing deployment secret once.
 *
 * @example await createInitialAdmin({ displayName, email, password, role: 'owner' }, secret)
 */
export async function createInitialAdmin(
  input: NewAdminAccount,
  deploymentSecret: string,
): Promise<AdminProfile> {
  if (!(await isInitialAdminSetupAvailable())) {
    throw new Error('O primeiro acesso administrativo já foi configurado.');
  }

  if (!safeEqual(deploymentSecret, readRequiredEnv('ADMIN_PASSWORD'))) {
    throw new Error('Código de implantação inválido.');
  }

  const profile = await provisionAdminAccount({ ...input, role: 'owner' });
  await writeAdminSession(profile.email);
  return profile;
}

/**
 * Creates an individual Supabase Auth account and its enabled admin profile.
 *
 * @example await createAdminAccount({ displayName, email, password, role: 'operator' })
 */
export async function createAdminAccount(
  input: NewAdminAccount,
): Promise<AdminProfile> {
  return provisionAdminAccount(input);
}

/**
 * Changes the current account password after confirming its previous password.
 *
 * @example await updateAdminPassword(actor, 'senha-atual', 'nova-senha')
 */
export async function updateAdminPassword(
  actor: AdminActor,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const client = createAdminClient();
  const verification = await client.auth.signInWithPassword({
    email: actor.email,
    password: currentPassword,
  });

  if (verification.error) {
    throw new Error('A senha atual informada não confere.');
  }

  const response = await client.auth.admin.updateUserById(actor.authUserId, {
    password: nextPassword,
  });

  if (response.error) {
    throw new Error(
      `Falha ao atualizar a senha de "${actor.email}": ${response.error.message}`,
    );
  }
}

/**
 * Enables or revokes an account in the app and in Supabase Auth.
 *
 * @example await setAdminAccountActivity('operacao@conexao.com', false)
 */
export async function setAdminAccountActivity(
  email: string,
  isActive: boolean,
): Promise<AdminProfile | null> {
  const client = createAdminClient();
  const profile = await setAdminProfileActivity(client, email, isActive);

  if (!profile?.authUserId) {
    return profile;
  }

  const response = await client.auth.admin.updateUserById(profile.authUserId, {
    ban_duration: isActive ? 'none' : DISABLED_USER_BAN_DURATION,
  });

  if (response.error) {
    throw new Error(
      `Falha ao ${isActive ? 'reativar' : 'bloquear'} "${email}": ${response.error.message}`,
    );
  }

  return profile;
}

export async function signOutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
