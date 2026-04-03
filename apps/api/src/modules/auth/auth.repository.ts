import type { AuthUser } from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import type { DbExecutor } from '../../db';

interface UserRow {
  id: string;
  login_id: string;
  password_hash: string;
}

function mapAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    loginId: row.login_id
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
