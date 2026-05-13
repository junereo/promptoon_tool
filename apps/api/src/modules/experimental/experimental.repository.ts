import type {
  ExperimentalAccessGrant,
  ExperimentalAccessTarget,
  ExperimentalAccessTargetStatus,
  ExperimentalAccessTargetType,
  ExperimentalInviteCode,
  ExperimentalInviteCodeStatus
} from '@promptoon/shared';

import type { DbExecutor } from '../../db';

interface TargetRow {
  id: string;
  target_type: ExperimentalAccessTargetType;
  project_id: string | null;
  project_title: string | null;
  publish_id: string | null;
  episode_id: string | null;
  episode_title: string | null;
  status: ExperimentalAccessTargetStatus;
  grant_count: string | number;
  invite_code_count: string | number;
  created_at: Date;
  updated_at: Date;
}

interface GrantRow {
  id: string;
  target_id: string;
  user_id: string;
  login_id: string;
  source: 'manual' | 'invite_code';
  source_invite_code_id: string | null;
  status: 'active' | 'revoked';
  granted_by: string | null;
  granted_at: Date;
  revoked_at: Date | null;
  updated_at: Date;
}

interface InviteCodeRow {
  id: string;
  target_id: string;
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

export interface InviteCodeLockRow extends InviteCodeRow {
  target_status: ExperimentalAccessTargetStatus;
}

type InviteCodeVisibility = 'active' | 'history' | 'all';

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function mapTarget(row: TargetRow): ExperimentalAccessTarget {
  return {
    id: row.id,
    targetType: row.target_type,
    projectId: row.project_id,
    projectTitle: row.project_title,
    publishId: row.publish_id,
    episodeId: row.episode_id,
    episodeTitle: row.episode_title,
    status: row.status,
    grantCount: toNumber(row.grant_count),
    inviteCodeCount: toNumber(row.invite_code_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function mapGrant(row: GrantRow): ExperimentalAccessGrant {
  return {
    id: row.id,
    targetId: row.target_id,
    userId: row.user_id,
    loginId: row.login_id,
    source: row.source,
    sourceInviteCodeId: row.source_invite_code_id,
    status: row.status,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString()
  };
}

function getInviteCodeStatus(row: InviteCodeRow): ExperimentalInviteCodeStatus {
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

export function mapInviteCode(row: InviteCodeRow): ExperimentalInviteCode {
  return {
    id: row.id,
    targetId: row.target_id,
    maskedCode: `${row.code_prefix}-****-${row.code_suffix}`,
    status: getInviteCodeStatus(row),
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    expiresAt: row.expires_at.toISOString(),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function getFeedItemTargetMatch(feedItemAlias: string, targetAlias: string, options: { includeGlobal?: boolean } = {}): string {
  const clauses = [
    `(${targetAlias}.target_type = 'project' AND ${targetAlias}.project_id = ${feedItemAlias}.project_id)`,
    `(
      ${targetAlias}.target_type = 'publish'
      AND ${feedItemAlias}.publish_id IS NOT NULL
      AND (
        ${targetAlias}.publish_id = ${feedItemAlias}.publish_id
        OR EXISTS (
          SELECT 1
          FROM promptoon_publish AS target_publish
          WHERE target_publish.id = ${targetAlias}.publish_id
            AND target_publish.episode_id = ${feedItemAlias}.episode_id
        )
      )
    )`
  ];

  if (options.includeGlobal) {
    clauses.unshift(`${targetAlias}.target_type = 'all'`);
  }

  return `(${clauses.join(' OR ')})`;
}

function getPublishTargetMatch(publishAlias: string, targetAlias: string, options: { includeGlobal?: boolean } = {}): string {
  const clauses = [
    `(${targetAlias}.target_type = 'project' AND ${targetAlias}.project_id = ${publishAlias}.project_id)`,
    `(
      ${targetAlias}.target_type = 'publish'
      AND (
        ${targetAlias}.publish_id = ${publishAlias}.id
        OR EXISTS (
          SELECT 1
          FROM promptoon_publish AS target_publish
          WHERE target_publish.id = ${targetAlias}.publish_id
            AND target_publish.episode_id = ${publishAlias}.episode_id
        )
      )
    )`
  ];

  if (options.includeGlobal) {
    clauses.unshift(`${targetAlias}.target_type = 'all'`);
  }

  return `(${clauses.join(' OR ')})`;
}

export function buildFeedItemAccessPredicate(feedItemAlias: string, userParamSql?: string): string {
  const restrictedMatch = getFeedItemTargetMatch(feedItemAlias, 'restricted_target');
  const grantMatch = getFeedItemTargetMatch(feedItemAlias, 'grant_target', { includeGlobal: true });

  return `(
    NOT EXISTS (
      SELECT 1
      FROM promptoon_experimental_access_target AS restricted_target
      WHERE restricted_target.status = 'active'
        AND ${restrictedMatch}
    )
    OR ${
      userParamSql
        ? `EXISTS (
            SELECT 1
            FROM promptoon_experimental_access_target AS grant_target
            INNER JOIN promptoon_experimental_access_grant AS access_grant
              ON access_grant.target_id = grant_target.id
             AND access_grant.user_id = ${userParamSql}
             AND access_grant.status = 'active'
            WHERE grant_target.status = 'active'
              AND ${grantMatch}
          )`
        : 'FALSE'
    }
  )`;
}

export function buildFeedItemExperimentalPredicate(feedItemAlias: string, userParamSql?: string): string {
  if (!userParamSql) {
    return 'FALSE';
  }

  const restrictedMatch = getFeedItemTargetMatch(feedItemAlias, 'restricted_target');
  const grantMatch = getFeedItemTargetMatch(feedItemAlias, 'experimental_target', { includeGlobal: true });

  return `(
    EXISTS (
      SELECT 1
      FROM promptoon_experimental_access_target AS restricted_target
      WHERE restricted_target.status = 'active'
        AND ${restrictedMatch}
    )
    AND EXISTS (
      SELECT 1
      FROM promptoon_experimental_access_target AS experimental_target
      INNER JOIN promptoon_experimental_access_grant AS experimental_grant
        ON experimental_grant.target_id = experimental_target.id
       AND experimental_grant.user_id = ${userParamSql}
       AND experimental_grant.status = 'active'
      WHERE experimental_target.status = 'active'
        AND ${grantMatch}
    )
  )`;
}

export function buildPublishAccessPredicate(publishAlias: string, userParamSql?: string): string {
  const restrictedMatch = getPublishTargetMatch(publishAlias, 'restricted_target');
  const grantMatch = getPublishTargetMatch(publishAlias, 'grant_target', { includeGlobal: true });

  return `(
    NOT EXISTS (
      SELECT 1
      FROM promptoon_experimental_access_target AS restricted_target
      WHERE restricted_target.status = 'active'
        AND ${restrictedMatch}
    )
    OR ${
      userParamSql
        ? `EXISTS (
            SELECT 1
            FROM promptoon_experimental_access_target AS grant_target
            INNER JOIN promptoon_experimental_access_grant AS access_grant
              ON access_grant.target_id = grant_target.id
             AND access_grant.user_id = ${userParamSql}
             AND access_grant.status = 'active'
            WHERE grant_target.status = 'active'
              AND ${grantMatch}
          )`
        : 'FALSE'
    }
  )`;
}

function getTargetSelect(): string {
  return `
    SELECT
      target.id,
      target.target_type,
      target.project_id,
      project.title AS project_title,
      target.publish_id,
      publish.episode_id,
      episode.title AS episode_title,
      target.status,
      COUNT(DISTINCT active_grant.id)::text AS grant_count,
      COUNT(DISTINCT invite_code.id)::text AS invite_code_count,
      target.created_at,
      target.updated_at
    FROM promptoon_experimental_access_target AS target
    LEFT JOIN promptoon_project AS project ON project.id = target.project_id
    LEFT JOIN promptoon_publish AS publish ON publish.id = target.publish_id
    LEFT JOIN promptoon_episode AS episode ON episode.id = publish.episode_id
    LEFT JOIN promptoon_experimental_access_grant AS active_grant
      ON active_grant.target_id = target.id AND active_grant.status = 'active'
    LEFT JOIN promptoon_experimental_invite_code AS invite_code ON invite_code.target_id = target.id`;
}

export async function listTargets(db: DbExecutor): Promise<ExperimentalAccessTarget[]> {
  const result = await db.query<TargetRow>(
    `${getTargetSelect()}
     GROUP BY target.id, project.title, publish.episode_id, episode.title
     ORDER BY target.created_at DESC, target.id DESC`
  );
  return result.rows.map(mapTarget);
}

export async function getTarget(db: DbExecutor, targetId: string): Promise<ExperimentalAccessTarget | null> {
  const result = await db.query<TargetRow>(
    `${getTargetSelect()}
     WHERE target.id = $1
     GROUP BY target.id, project.title, publish.episode_id, episode.title
     LIMIT 1`,
    [targetId]
  );
  return result.rows[0] ? mapTarget(result.rows[0]) : null;
}

export async function getProjectIdForPublish(db: DbExecutor, publishId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>('SELECT project_id FROM promptoon_publish WHERE id = $1', [publishId]);
  return result.rows[0]?.project_id ?? null;
}

export async function projectExists(db: DbExecutor, projectId: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM promptoon_project
       WHERE id = $1
     ) AS exists`,
    [projectId]
  );
  return result.rows[0]?.exists ?? false;
}

export async function upsertTarget(
  db: DbExecutor,
  input: {
    actorUserId: string;
    projectId?: string | null;
    publishId?: string | null;
    targetType: ExperimentalAccessTargetType;
  }
): Promise<ExperimentalAccessTarget | null> {
  const result = await db.query<{ id: string }>(
    input.targetType === 'all'
      ? `INSERT INTO promptoon_experimental_access_target (target_type, project_id, publish_id, status, created_by)
         VALUES ('all', NULL, NULL, 'active', $1)
         ON CONFLICT (target_type) WHERE target_type = 'all'
         DO UPDATE SET status = 'active', updated_at = NOW()
         RETURNING id`
      : input.targetType === 'project'
        ? `INSERT INTO promptoon_experimental_access_target (target_type, project_id, publish_id, status, created_by)
           VALUES ('project', $1, NULL, 'active', $2)
           ON CONFLICT (project_id) WHERE target_type = 'project'
           DO UPDATE SET status = 'active', updated_at = NOW()
           RETURNING id`
        : `INSERT INTO promptoon_experimental_access_target (target_type, project_id, publish_id, status, created_by)
           VALUES ('publish', $1, $2, 'active', $3)
           ON CONFLICT (publish_id) WHERE target_type = 'publish'
           DO UPDATE SET status = 'active', updated_at = NOW()
           RETURNING id`,
    input.targetType === 'all'
      ? [input.actorUserId]
      : input.targetType === 'project'
        ? [input.projectId, input.actorUserId]
        : [input.projectId, input.publishId, input.actorUserId]
  );

  return getTarget(db, result.rows[0]?.id ?? '');
}

export async function setProjectTargetActive(
  db: DbExecutor,
  input: {
    actorUserId: string;
    isExperimental: boolean;
    projectId: string;
  }
): Promise<void> {
  if (input.isExperimental) {
    await upsertTarget(db, {
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      targetType: 'project'
    });
    return;
  }

  await db.query(
    `UPDATE promptoon_experimental_access_target
     SET status = 'disabled', updated_at = NOW()
     WHERE target_type = 'project'
       AND project_id = $1`,
    [input.projectId]
  );
}

export async function updateTargetStatus(
  db: DbExecutor,
  input: {
    status: ExperimentalAccessTargetStatus;
    targetId: string;
  }
): Promise<ExperimentalAccessTarget | null> {
  const result = await db.query<{ id: string }>(
    `UPDATE promptoon_experimental_access_target
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [input.targetId, input.status]
  );
  return getTarget(db, result.rows[0]?.id ?? '');
}

export async function deleteTarget(db: DbExecutor, targetId: string): Promise<boolean> {
  const result = await db.query<{ id: string }>(
    `DELETE FROM promptoon_experimental_access_target
     WHERE id = $1
     RETURNING id`,
    [targetId]
  );
  return Boolean(result.rows[0]);
}

export async function listGrants(db: DbExecutor, targetId?: string): Promise<ExperimentalAccessGrant[]> {
  const values: unknown[] = [];
  const whereClause = targetId ? 'WHERE access_grant.target_id = $1' : '';
  if (targetId) {
    values.push(targetId);
  }

  const result = await db.query<GrantRow>(
    `SELECT
       access_grant.id,
       access_grant.target_id,
       access_grant.user_id,
       users.login_id,
       access_grant.source,
       access_grant.source_invite_code_id,
       access_grant.status,
       access_grant.granted_by,
       access_grant.granted_at,
       access_grant.revoked_at,
       access_grant.updated_at
     FROM promptoon_experimental_access_grant AS access_grant
     INNER JOIN users ON users.id = access_grant.user_id
     ${whereClause}
     ORDER BY access_grant.granted_at DESC, access_grant.id DESC`,
    values
  );
  return result.rows.map(mapGrant);
}

export async function listActiveGrantsForUser(db: DbExecutor, userId: string): Promise<ExperimentalAccessGrant[]> {
  const result = await db.query<GrantRow>(
    `SELECT
       access_grant.id,
       access_grant.target_id,
       access_grant.user_id,
       users.login_id,
       access_grant.source,
       access_grant.source_invite_code_id,
       access_grant.status,
       access_grant.granted_by,
       access_grant.granted_at,
       access_grant.revoked_at,
       access_grant.updated_at
     FROM promptoon_experimental_access_grant AS access_grant
     INNER JOIN promptoon_experimental_access_target AS target ON target.id = access_grant.target_id
     INNER JOIN users ON users.id = access_grant.user_id
     WHERE access_grant.user_id = $1
       AND access_grant.status = 'active'
       AND target.status = 'active'
     ORDER BY access_grant.granted_at DESC, access_grant.id DESC`,
    [userId]
  );
  return result.rows.map(mapGrant);
}

export async function getUserIdByLoginId(db: DbExecutor, loginId: string): Promise<string | null> {
  const result = await db.query<{ id: string }>('SELECT id FROM users WHERE login_id = $1', [loginId]);
  return result.rows[0]?.id ?? null;
}

export async function upsertManualGrant(
  db: DbExecutor,
  input: {
    actorUserId: string;
    targetId: string;
    userId: string;
  }
): Promise<ExperimentalAccessGrant | null> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO promptoon_experimental_access_grant (target_id, user_id, source, status, granted_by, granted_at, revoked_at)
     VALUES ($1, $2, 'manual', 'active', $3, NOW(), NULL)
     ON CONFLICT (target_id, user_id)
     DO UPDATE SET source = 'manual',
                   source_invite_code_id = NULL,
                   status = 'active',
                   granted_by = EXCLUDED.granted_by,
                   granted_at = NOW(),
                   revoked_at = NULL,
                   updated_at = NOW()
     RETURNING id`,
    [input.targetId, input.userId, input.actorUserId]
  );
  return getGrant(db, result.rows[0]?.id ?? '');
}

export async function upsertInviteGrant(
  db: DbExecutor,
  input: {
    inviteCodeId: string;
    targetId: string;
    userId: string;
  }
): Promise<ExperimentalAccessGrant | null> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO promptoon_experimental_access_grant (target_id, user_id, source, source_invite_code_id, status, granted_at, revoked_at)
     VALUES ($1, $2, 'invite_code', $3, 'active', NOW(), NULL)
     ON CONFLICT (target_id, user_id)
     DO UPDATE SET source = 'invite_code',
                   source_invite_code_id = EXCLUDED.source_invite_code_id,
                   status = 'active',
                   granted_at = NOW(),
                   revoked_at = NULL,
                   updated_at = NOW()
     RETURNING id`,
    [input.targetId, input.userId, input.inviteCodeId]
  );
  return getGrant(db, result.rows[0]?.id ?? '');
}

export async function getGrant(db: DbExecutor, grantId: string): Promise<ExperimentalAccessGrant | null> {
  const result = await db.query<GrantRow>(
    `SELECT
       access_grant.id,
       access_grant.target_id,
       access_grant.user_id,
       users.login_id,
       access_grant.source,
       access_grant.source_invite_code_id,
       access_grant.status,
       access_grant.granted_by,
       access_grant.granted_at,
       access_grant.revoked_at,
       access_grant.updated_at
     FROM promptoon_experimental_access_grant AS access_grant
     INNER JOIN users ON users.id = access_grant.user_id
     WHERE access_grant.id = $1
     LIMIT 1`,
    [grantId]
  );
  return result.rows[0] ? mapGrant(result.rows[0]) : null;
}

export async function updateGrantStatus(
  db: DbExecutor,
  input: {
    grantId: string;
    status: 'active' | 'revoked';
  }
): Promise<ExperimentalAccessGrant | null> {
  const result = await db.query<{ id: string }>(
    `UPDATE promptoon_experimental_access_grant
     SET status = $2,
         revoked_at = CASE WHEN $2 = 'revoked' THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [input.grantId, input.status]
  );
  return getGrant(db, result.rows[0]?.id ?? '');
}

export async function insertInviteCode(
  db: DbExecutor,
  input: {
    codeHash: string;
    codePrefix: string;
    codeSuffix: string;
    createdBy: string;
    expiresAt: string;
    maxRedemptions: number;
    targetId: string;
  }
): Promise<ExperimentalInviteCode> {
  const result = await db.query<InviteCodeRow>(
    `INSERT INTO promptoon_experimental_invite_code (
       target_id,
       code_hash,
       code_prefix,
       code_suffix,
       max_redemptions,
       expires_at,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)
     RETURNING *`,
    [input.targetId, input.codeHash, input.codePrefix, input.codeSuffix, input.maxRedemptions, input.expiresAt, input.createdBy]
  );
  return mapInviteCode(result.rows[0]);
}

export async function listInviteCodes(
  db: DbExecutor,
  input: {
    limit?: number;
    offset?: number;
    targetId?: string;
    visibility?: InviteCodeVisibility;
  } = {}
): Promise<ExperimentalInviteCode[]> {
  const values: unknown[] = [];
  const whereClauses: string[] = [];
  if (input.targetId) {
    values.push(input.targetId);
    whereClauses.push(`target_id = $${values.length}`);
  }
  if (input.visibility === 'active') {
    whereClauses.push("status = 'active' AND expires_at > NOW() AND redeemed_count < max_redemptions");
  } else if (input.visibility === 'history') {
    whereClauses.push("(status = 'revoked' OR expires_at <= NOW() OR redeemed_count >= max_redemptions)");
  }
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const limitClause = input.limit ? `LIMIT $${values.push(input.limit)}` : '';
  const offsetClause = input.offset ? `OFFSET $${values.push(input.offset)}` : '';
  const result = await db.query<InviteCodeRow>(
    `SELECT *
     FROM promptoon_experimental_invite_code
     ${whereClause}
     ORDER BY updated_at DESC, id DESC
     ${limitClause}
     ${offsetClause}`,
    values
  );
  return result.rows.map(mapInviteCode);
}

export async function countInviteCodes(
  db: DbExecutor,
  input: {
    targetId?: string;
    visibility?: InviteCodeVisibility;
  } = {}
): Promise<number> {
  const values: unknown[] = [];
  const whereClauses: string[] = [];
  if (input.targetId) {
    values.push(input.targetId);
    whereClauses.push(`target_id = $${values.length}`);
  }
  if (input.visibility === 'active') {
    whereClauses.push("status = 'active' AND expires_at > NOW() AND redeemed_count < max_redemptions");
  } else if (input.visibility === 'history') {
    whereClauses.push("(status = 'revoked' OR expires_at <= NOW() OR redeemed_count >= max_redemptions)");
  }
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM promptoon_experimental_invite_code
     ${whereClause}`,
    values
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function revokeInviteCode(db: DbExecutor, codeId: string): Promise<ExperimentalInviteCode | null> {
  const result = await db.query<InviteCodeRow>(
    `UPDATE promptoon_experimental_invite_code
     SET status = 'revoked', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [codeId]
  );
  return result.rows[0] ? mapInviteCode(result.rows[0]) : null;
}

export async function getInviteCodeForUpdate(db: DbExecutor, codeHash: string): Promise<InviteCodeLockRow | null> {
  const result = await db.query<InviteCodeLockRow>(
    `SELECT invite_code.*, target.status AS target_status
     FROM promptoon_experimental_invite_code AS invite_code
     INNER JOIN promptoon_experimental_access_target AS target ON target.id = invite_code.target_id
     WHERE invite_code.code_hash = $1
     FOR UPDATE OF invite_code`,
    [codeHash]
  );
  return result.rows[0] ?? null;
}

export async function hasRedeemedInviteCode(db: DbExecutor, input: { inviteCodeId: string; userId: string }): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM promptoon_experimental_invite_redemption
       WHERE invite_code_id = $1 AND user_id = $2
     ) AS exists`,
    [input.inviteCodeId, input.userId]
  );
  return result.rows[0]?.exists ?? false;
}

export async function createInviteRedemption(
  db: DbExecutor,
  input: {
    grantId: string;
    inviteCodeId: string;
    userId: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_experimental_invite_redemption (invite_code_id, user_id, grant_id)
     VALUES ($1, $2, $3)`,
    [input.inviteCodeId, input.userId, input.grantId]
  );
}

export async function incrementInviteRedemptionCount(db: DbExecutor, inviteCodeId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_experimental_invite_code
     SET redeemed_count = redeemed_count + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [inviteCodeId]
  );
}

export async function listAccessibleResolvedPublishIds(
  db: DbExecutor,
  input: {
    publishIds: string[];
    userId?: string;
  }
): Promise<Set<string>> {
  if (input.publishIds.length === 0) {
    return new Set();
  }

  const values: unknown[] = [input.publishIds];
  const userParam = input.userId ? `$${values.push(input.userId)}` : undefined;
  const result = await db.query<{ publish_id: string }>(
    `SELECT COALESCE(item.publish_id, item.movingtoon_publish_id)::text AS publish_id
     FROM promptoon_feed_item AS item
     WHERE COALESCE(item.publish_id, item.movingtoon_publish_id) = ANY($1::uuid[])
       AND ${buildFeedItemAccessPredicate('item', userParam)}`,
    values
  );
  return new Set(result.rows.map((row) => row.publish_id));
}

export async function canAccessPublish(
  db: DbExecutor,
  input: {
    publishId: string;
    userId?: string;
  }
): Promise<boolean> {
  const values: unknown[] = [input.publishId];
  const userParam = input.userId ? `$${values.push(input.userId)}` : undefined;
  const result = await db.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM promptoon_publish AS publish
       WHERE publish.id = $1
         AND ${buildPublishAccessPredicate('publish', userParam)}
     ) AS allowed`,
    values
  );
  return result.rows[0]?.allowed ?? false;
}
