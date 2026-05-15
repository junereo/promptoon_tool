import type {
  PlatformAccessCode,
  PlatformAccessCodeStatus,
  PlatformAccessGrant,
  PlatformAccessGrantSource,
  PlatformAccessGrantStatus
} from '@promptoon/shared';

import type { DbExecutor } from '../../db';

interface PlatformAccessGrantRow {
  id: string;
  user_id: string;
  login_id: string;
  source: PlatformAccessGrantSource;
  source_code_id: string | null;
  status: PlatformAccessGrantStatus;
  granted_by: string | null;
  granted_at: Date;
  revoked_at: Date | null;
  updated_at: Date;
}

interface PlatformAccessCodeRow {
  id: string;
  code_prefix: string;
  code_suffix: string;
  status: 'active' | 'revoked';
  max_redemptions: number;
  redeemed_count: number;
  expires_at: Date;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PlatformAccessCodeLockRow extends PlatformAccessCodeRow {
  code_hash: string;
}

type CodeVisibility = 'active' | 'history';

function mapGrant(row: PlatformAccessGrantRow): PlatformAccessGrant {
  return {
    id: row.id,
    userId: row.user_id,
    loginId: row.login_id,
    source: row.source,
    sourceCodeId: row.source_code_id,
    status: row.status,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString()
  };
}

function getCodeStatus(row: PlatformAccessCodeRow): PlatformAccessCodeStatus {
  if (row.status === 'revoked') {
    return 'revoked';
  }

  if (row.expires_at.getTime() <= Date.now()) {
    return 'expired';
  }

  if (row.redeemed_count >= row.max_redemptions) {
    return 'exhausted';
  }

  return 'active';
}

export function mapCode(row: PlatformAccessCodeRow): PlatformAccessCode {
  return {
    id: row.id,
    maskedCode: `${row.code_prefix}-****-${row.code_suffix}`,
    status: getCodeStatus(row),
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    expiresAt: row.expires_at.toISOString(),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getUserIdByLoginId(db: DbExecutor, loginId: string): Promise<string | null> {
  const result = await db.query<{ id: string }>('SELECT id FROM users WHERE login_id = $1', [loginId]);
  return result.rows[0]?.id ?? null;
}

export async function getActiveGrantForUser(db: DbExecutor, userId: string): Promise<PlatformAccessGrant | null> {
  const result = await db.query<PlatformAccessGrantRow>(
    `SELECT grant.id,
            grant.user_id,
            users.login_id,
            grant.source,
            grant.source_code_id,
            grant.status,
            grant.granted_by,
            grant.granted_at,
            grant.revoked_at,
            grant.updated_at
     FROM promptoon_platform_access_grant AS grant
     INNER JOIN users ON users.id = grant.user_id
     WHERE grant.user_id = $1
       AND grant.status = 'active'
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ? mapGrant(result.rows[0]) : null;
}

export async function listGrants(db: DbExecutor): Promise<PlatformAccessGrant[]> {
  const result = await db.query<PlatformAccessGrantRow>(
    `SELECT grant.id,
            grant.user_id,
            users.login_id,
            grant.source,
            grant.source_code_id,
            grant.status,
            grant.granted_by,
            grant.granted_at,
            grant.revoked_at,
            grant.updated_at
     FROM promptoon_platform_access_grant AS grant
     INNER JOIN users ON users.id = grant.user_id
     ORDER BY CASE grant.status WHEN 'active' THEN 0 ELSE 1 END,
              grant.granted_at DESC,
              grant.id DESC`
  );

  return result.rows.map(mapGrant);
}

async function getGrantById(db: DbExecutor, grantId: string): Promise<PlatformAccessGrant | null> {
  const result = await db.query<PlatformAccessGrantRow>(
    `SELECT grant.id,
            grant.user_id,
            users.login_id,
            grant.source,
            grant.source_code_id,
            grant.status,
            grant.granted_by,
            grant.granted_at,
            grant.revoked_at,
            grant.updated_at
     FROM promptoon_platform_access_grant AS grant
     INNER JOIN users ON users.id = grant.user_id
     WHERE grant.id = $1
     LIMIT 1`,
    [grantId]
  );

  return result.rows[0] ? mapGrant(result.rows[0]) : null;
}

export async function upsertGrant(
  db: DbExecutor,
  input: {
    grantedBy?: string | null;
    source: PlatformAccessGrantSource;
    sourceCodeId?: string | null;
    userId: string;
  }
): Promise<PlatformAccessGrant | null> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO promptoon_platform_access_grant (user_id, source, source_code_id, status, granted_by, revoked_at)
     VALUES ($1, $2, $3, 'active', $4, NULL)
     ON CONFLICT (user_id) DO UPDATE
       SET source = EXCLUDED.source,
           source_code_id = EXCLUDED.source_code_id,
           status = 'active',
           granted_by = COALESCE(EXCLUDED.granted_by, promptoon_platform_access_grant.granted_by),
           revoked_at = NULL,
           granted_at = CASE
             WHEN promptoon_platform_access_grant.status = 'active' THEN promptoon_platform_access_grant.granted_at
             ELSE NOW()
           END,
           updated_at = NOW()
     RETURNING id`,
    [input.userId, input.source, input.sourceCodeId ?? null, input.grantedBy ?? null]
  );

  return result.rows[0] ? getGrantById(db, result.rows[0].id) : null;
}

export async function updateGrantStatus(
  db: DbExecutor,
  input: {
    grantId: string;
    status: PlatformAccessGrantStatus;
  }
): Promise<PlatformAccessGrant | null> {
  const result = await db.query<{ id: string }>(
    `UPDATE promptoon_platform_access_grant
     SET status = $2,
         revoked_at = CASE WHEN $2 = 'revoked' THEN NOW() ELSE NULL END,
         granted_at = CASE WHEN $2 = 'active' AND status <> 'active' THEN NOW() ELSE granted_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [input.grantId, input.status]
  );

  return result.rows[0] ? getGrantById(db, result.rows[0].id) : null;
}

export async function listCodes(
  db: DbExecutor,
  input: {
    limit?: number;
    offset?: number;
    visibility: CodeVisibility;
  }
): Promise<PlatformAccessCode[]> {
  const visibilityFilter =
    input.visibility === 'active'
      ? `status = 'active' AND expires_at > NOW() AND redeemed_count < max_redemptions`
      : `status <> 'active' OR expires_at <= NOW() OR redeemed_count >= max_redemptions`;
  const result = await db.query<PlatformAccessCodeRow>(
    `SELECT id, code_prefix, code_suffix, status, max_redemptions, redeemed_count, expires_at, created_by, created_at, updated_at
     FROM promptoon_platform_access_code
     WHERE ${visibilityFilter}
     ORDER BY updated_at DESC, created_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [input.limit ?? 100, input.offset ?? 0]
  );

  return result.rows.map(mapCode);
}

export async function countCodes(db: DbExecutor, input: { visibility: CodeVisibility }): Promise<number> {
  const visibilityFilter =
    input.visibility === 'active'
      ? `status = 'active' AND expires_at > NOW() AND redeemed_count < max_redemptions`
      : `status <> 'active' OR expires_at <= NOW() OR redeemed_count >= max_redemptions`;
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM promptoon_platform_access_code
     WHERE ${visibilityFilter}`
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function insertCode(
  db: DbExecutor,
  input: {
    codeHash: string;
    codePrefix: string;
    codeSuffix: string;
    createdBy: string;
    expiresAt: string;
    maxRedemptions: number;
  }
): Promise<PlatformAccessCode> {
  const result = await db.query<PlatformAccessCodeRow>(
    `INSERT INTO promptoon_platform_access_code (
       code_hash,
       code_prefix,
       code_suffix,
       created_by,
       expires_at,
       max_redemptions
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, code_prefix, code_suffix, status, max_redemptions, redeemed_count, expires_at, created_by, created_at, updated_at`,
    [input.codeHash, input.codePrefix, input.codeSuffix, input.createdBy, input.expiresAt, input.maxRedemptions]
  );

  return mapCode(result.rows[0]);
}

export async function revokeCode(db: DbExecutor, codeId: string): Promise<PlatformAccessCode | null> {
  const result = await db.query<PlatformAccessCodeRow>(
    `UPDATE promptoon_platform_access_code
     SET status = 'revoked',
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, code_prefix, code_suffix, status, max_redemptions, redeemed_count, expires_at, created_by, created_at, updated_at`,
    [codeId]
  );

  return result.rows[0] ? mapCode(result.rows[0]) : null;
}

export async function getCodeForUpdate(db: DbExecutor, codeHash: string): Promise<PlatformAccessCodeLockRow | null> {
  const result = await db.query<PlatformAccessCodeLockRow>(
    `SELECT id,
            code_hash,
            code_prefix,
            code_suffix,
            status,
            max_redemptions,
            redeemed_count,
            expires_at,
            created_by,
            created_at,
            updated_at
     FROM promptoon_platform_access_code
     WHERE code_hash = $1
     FOR UPDATE`,
    [codeHash]
  );

  return result.rows[0] ?? null;
}

export async function hasRedeemedCode(db: DbExecutor, input: { codeId: string; userId: string }): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM promptoon_platform_access_redemption
       WHERE code_id = $1
         AND user_id = $2
     ) AS exists`,
    [input.codeId, input.userId]
  );

  return result.rows[0]?.exists ?? false;
}

export async function createRedemption(
  db: DbExecutor,
  input: {
    codeId: string;
    grantId: string;
    userId: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_platform_access_redemption (code_id, user_id, grant_id)
     VALUES ($1, $2, $3)`,
    [input.codeId, input.userId, input.grantId]
  );
}

export async function incrementCodeRedemptionCount(db: DbExecutor, codeId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_platform_access_code
     SET redeemed_count = redeemed_count + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [codeId]
  );
}
