import type { AuthSession, AuthUser } from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import type { DbExecutor } from '../../db';

interface UserRow {
  id: string;
  login_id: string;
  password_hash: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

function mapAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    loginId: row.login_id
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

export async function getUserByLoginId(
  db: DbExecutor,
  loginId: string
): Promise<(AuthUser & { passwordHash: string }) | null> {
  const result = await db.query<UserRow>('SELECT * FROM users WHERE login_id = $1', [loginId]);
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapAuthUser(row),
    passwordHash: row.password_hash
  };
}

export async function createUser(
  db: DbExecutor,
  input: { loginId: string; passwordHash: string }
): Promise<AuthUser> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (id, login_id, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [randomUUID(), input.loginId, input.passwordHash]
  );

  return mapAuthUser(result.rows[0]);
}

export async function getUserById(db: DbExecutor, userId: string): Promise<AuthUser | null> {
  const result = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] ? mapAuthUser(result.rows[0]) : null;
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

export async function createSession(db: DbExecutor, userId: string): Promise<AuthSession> {
  const result = await db.query<SessionRow>(
    `INSERT INTO promptoon_session (user_id, expires_at)
     VALUES ($1, NOW() + INTERVAL '7 days')
     RETURNING *`,
    [userId]
  );

  return mapAuthSession(result.rows[0]);
}

export async function getActiveSession(db: DbExecutor, input: { sessionId: string; userId: string }): Promise<AuthSession | null> {
  const result = await db.query<SessionRow>(
    `SELECT *
     FROM promptoon_session
     WHERE id = $1
       AND user_id = $2
       AND expires_at > NOW()`,
    [input.sessionId, input.userId]
  );

  return result.rows[0] ? mapAuthSession(result.rows[0]) : null;
}

export async function deleteSession(db: DbExecutor, input: { sessionId: string; userId: string }): Promise<void> {
  await db.query('DELETE FROM promptoon_session WHERE id = $1 AND user_id = $2', [input.sessionId, input.userId]);
}

export async function deleteSessionsForUser(db: DbExecutor, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_session WHERE user_id = $1', [userId]);
}
