import type { AuthSession, AuthUser } from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import type { DbExecutor } from '../../db';

interface UserRow {
  id: string;
  login_id: string;
  password_hash: string;
  email: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  sns_profile_image_url?: string | null;
  discourse_username: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by_session_id: string | null;
  revoke_reason: string | null;
}

interface OAuthAccountRow {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  email: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuthUserRecord extends AuthUser {
  passwordHash: string;
  email?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
  discourseUsername?: string | null;
}

export interface OAuthProfileInput {
  provider: 'google';
  providerAccountId: string;
  email?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
}

function mapAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    loginId: row.login_id,
    snsProfileImageUrl: row.sns_profile_image_url ?? null
  };
}

function mapAuthSession(row: SessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString()
  };
}

function mapAuthUserRecord(row: UserRow): AuthUserRecord {
  return {
    ...mapAuthUser(row),
    passwordHash: row.password_hash,
    email: row.email,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url,
    discourseUsername: row.discourse_username
  };
}

export async function getUserByLoginId(
  db: DbExecutor,
  loginId: string
): Promise<AuthUserRecord | null> {
  const result = await db.query<UserRow>(
    `SELECT users.*, oauth.profile_image_url AS sns_profile_image_url
     FROM users
     LEFT JOIN LATERAL (
       SELECT profile_image_url
       FROM promptoon_oauth_account
       WHERE user_id = users.id
         AND provider = 'google'
       ORDER BY updated_at DESC
       LIMIT 1
     ) AS oauth ON TRUE
     WHERE users.login_id = $1`,
    [loginId]
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapAuthUserRecord(row);
}

export async function resolveCurrentUserId(db: DbExecutor, userId: string): Promise<string> {
  if (!UUID_PATTERN.test(userId)) {
    return userId;
  }

  try {
    const result = await db.query<{ new_ulid: string }>(
      'SELECT new_ulid FROM promptoon_user_id_migration_map WHERE old_uuid = $1::uuid',
      [userId]
    );
    return result.rows[0]?.new_ulid ?? userId;
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') {
      return userId;
    }

    throw error;
  }
}

export async function createUser(
  db: DbExecutor,
  input: {
    loginId: string;
    passwordHash: string;
    email?: string | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    discourseUsername?: string | null;
  }
): Promise<AuthUser> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (login_id, password_hash, email, display_name, profile_image_url, discourse_username)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.loginId,
      input.passwordHash,
      input.email ?? null,
      input.displayName ?? null,
      input.profileImageUrl ?? null,
      input.discourseUsername ?? null
    ]
  );

  return mapAuthUser(result.rows[0]);
}

export async function getUserById(db: DbExecutor, userId: string): Promise<AuthUser | null> {
  const result = await db.query<UserRow>(
    `SELECT users.*, oauth.profile_image_url AS sns_profile_image_url
     FROM users
     LEFT JOIN LATERAL (
       SELECT profile_image_url
       FROM promptoon_oauth_account
       WHERE user_id = users.id
         AND provider = 'google'
       ORDER BY updated_at DESC
       LIMIT 1
     ) AS oauth ON TRUE
     WHERE users.id = $1`,
    [userId]
  );
  return result.rows[0] ? mapAuthUser(result.rows[0]) : null;
}

export async function getUserRecordById(db: DbExecutor, userId: string): Promise<AuthUserRecord | null> {
  const result = await db.query<UserRow>(
    `SELECT users.*, oauth.profile_image_url AS sns_profile_image_url
     FROM users
     LEFT JOIN LATERAL (
       SELECT profile_image_url
       FROM promptoon_oauth_account
       WHERE user_id = users.id
         AND provider = 'google'
       ORDER BY updated_at DESC
       LIMIT 1
     ) AS oauth ON TRUE
     WHERE users.id = $1`,
    [userId]
  );
  return result.rows[0] ? mapAuthUserRecord(result.rows[0]) : null;
}

export async function ensureStudioMember(db: DbExecutor, userId: string, role = 'studio_admin'): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_studio_member (user_id, role)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, role]
  );
}

export async function getStudioRole(db: DbExecutor, userId: string): Promise<string | null> {
  const result = await db.query<{ role: string }>('SELECT role FROM promptoon_studio_member WHERE user_id = $1', [userId]);
  return result.rows[0]?.role ?? null;
}

export async function createSession(
  db: DbExecutor,
  input: {
    sessionId?: string;
    userId: string;
    tokenHash?: string | null;
    expiresAt: Date;
  }
): Promise<AuthSession> {
  const result = await db.query<SessionRow>(
    `INSERT INTO promptoon_session (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.sessionId ?? randomUUID(), input.userId, input.tokenHash ?? null, input.expiresAt]
  );

  return mapAuthSession(result.rows[0]);
}

export async function getActiveSession(db: DbExecutor, input: { sessionId: string; userId: string }): Promise<AuthSession | null> {
  const result = await db.query<SessionRow>(
    `SELECT *
     FROM promptoon_session
     WHERE id = $1
       AND user_id = $2
       AND expires_at > NOW()
       AND revoked_at IS NULL`,
    [input.sessionId, input.userId]
  );

  return result.rows[0] ? mapAuthSession(result.rows[0]) : null;
}

export async function getSessionById(db: DbExecutor, sessionId: string): Promise<SessionRow | null> {
  const result = await db.query<SessionRow>('SELECT * FROM promptoon_session WHERE id = $1', [sessionId]);
  return result.rows[0] ?? null;
}

export async function deleteSession(db: DbExecutor, input: { sessionId: string; userId: string }): Promise<void> {
  await db.query('DELETE FROM promptoon_session WHERE id = $1 AND user_id = $2', [input.sessionId, input.userId]);
}

export async function deleteSessionsForUser(db: DbExecutor, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_session WHERE user_id = $1', [userId]);
}

export async function revokeSession(
  db: DbExecutor,
  input: {
    sessionId: string;
    userId?: string;
    reason: string;
    replacedBySessionId?: string | null;
  }
): Promise<void> {
  const values: unknown[] = [input.sessionId, input.reason, input.replacedBySessionId ?? null];
  const userClause = input.userId ? 'AND user_id = $4' : '';
  if (input.userId) {
    values.push(input.userId);
  }

  await db.query(
    `UPDATE promptoon_session
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, $2),
         replaced_by_session_id = COALESCE(replaced_by_session_id, $3)
     WHERE id = $1 ${userClause}`,
    values
  );
}

export async function revokeAllSessionsForUser(db: DbExecutor, userId: string, reason: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_session
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, $2)
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId, reason]
  );
}

export async function getUserByOAuthAccount(
  db: DbExecutor,
  input: { provider: string; providerAccountId: string }
): Promise<AuthUserRecord | null> {
  const result = await db.query<UserRow>(
    `SELECT users.*, account.profile_image_url AS sns_profile_image_url
     FROM promptoon_oauth_account AS account
     INNER JOIN users ON users.id = account.user_id
     WHERE account.provider = $1
       AND account.provider_account_id = $2`,
    [input.provider, input.providerAccountId]
  );

  return result.rows[0] ? mapAuthUserRecord(result.rows[0]) : null;
}

export async function upsertOAuthUser(db: DbExecutor, input: OAuthProfileInput): Promise<AuthUserRecord> {
  const existing = await getUserByOAuthAccount(db, {
    provider: input.provider,
    providerAccountId: input.providerAccountId
  });
  if (existing) {
    await db.query(
      `UPDATE promptoon_oauth_account
       SET email = $3,
           display_name = $4,
           profile_image_url = $5,
           updated_at = NOW()
       WHERE provider = $1
         AND provider_account_id = $2`,
      [input.provider, input.providerAccountId, input.email ?? null, input.displayName ?? null, input.profileImageUrl ?? null]
    );
    return await getUserByOAuthAccount(db, {
      provider: input.provider,
      providerAccountId: input.providerAccountId
    }) ?? existing;
  }

  const loginId = `${input.provider}:${input.providerAccountId}`;
  const passwordHash = `OAUTH_LOGIN_DISABLED:${randomUUID()}`;
  const userResult = await db.query<UserRow>(
    `INSERT INTO users (login_id, password_hash, email, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (login_id) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, users.email),
           display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           updated_at = NOW()
     RETURNING *`,
    [loginId, passwordHash, input.email ?? null, input.displayName ?? null]
  );
  const user = userResult.rows[0];

  await db.query<OAuthAccountRow>(
    `INSERT INTO promptoon_oauth_account (user_id, provider, provider_account_id, email, display_name, profile_image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, provider_account_id) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           profile_image_url = EXCLUDED.profile_image_url,
           updated_at = NOW()`,
    [user.id, input.provider, input.providerAccountId, input.email ?? null, input.displayName ?? null, input.profileImageUrl ?? null]
  );

  return await getUserByOAuthAccount(db, {
    provider: input.provider,
    providerAccountId: input.providerAccountId
  }) ?? mapAuthUserRecord(user);
}
