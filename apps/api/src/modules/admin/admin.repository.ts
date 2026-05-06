import type {
  AdminDiscourseSummaryResponse,
  AdminProjectListResponse,
  AdminPublishListResponse,
  AdminTelemetrySummaryResponse,
  AdminUserListResponse,
  AdminUserRoleFilter,
  AdminUserSummary,
  PlatformRole,
  StudioRole
} from '@promptoon/shared';

import type { DbExecutor } from '../../db';

interface UserSummaryRow {
  user_id: string;
  login_id: string;
  email: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  discourse_username: string | null;
  platform_role: PlatformRole | null;
  studio_role: StudioRole | null;
  project_count: string | number;
  publish_count: string | number;
  total_count?: string | number;
  created_at: Date;
  updated_at: Date;
}

interface ProjectSummaryRow {
  project_id: string;
  title: string;
  status: string;
  owner_id: string;
  owner_login_id: string;
  episode_count: string | number;
  publish_count: string | number;
  member_count: string | number;
  latest_published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface PublishSummaryRow {
  publish_id: string;
  project_id: string;
  project_title: string;
  episode_id: string;
  episode_title: string;
  episode_no: number;
  version_no: number;
  status: string;
  created_by: string;
  created_by_login_id: string;
  channel_id: string | null;
  series_id: string | null;
  feed_item_id: string | null;
  discourse_sync_status: string | null;
  discourse_topic_id: string | null;
  created_at: Date;
}

interface DiscourseStatusRow {
  status: string;
  count: string | number;
}

interface DiscourseItemRow {
  publish_id: string;
  project_title: string;
  episode_title: string;
  sync_status: string;
  discourse_topic_id: string | null;
  discourse_post_id: string | null;
  last_synced_at: Date | null;
  last_error: string | null;
  updated_at: Date;
}

interface TelemetryEventRow {
  event_name: string;
  count: string | number;
  latest_at: Date | null;
}

interface TelemetryDomainRow {
  domain: string;
  count: string | number;
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapUser(row: UserSummaryRow): AdminUserSummary {
  return {
    userId: row.user_id,
    loginId: row.login_id,
    email: row.email,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url,
    discourseUsername: row.discourse_username,
    platformRole: row.platform_role,
    studioRole: row.studio_role,
    projectCount: toNumber(row.project_count),
    publishCount: toNumber(row.publish_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function getUserSummarySelect(): string {
  return `
    SELECT
      users.id AS user_id,
      users.login_id,
      users.email,
      users.display_name,
      users.profile_image_url,
      users.discourse_username,
      platform.role AS platform_role,
      studio.role AS studio_role,
      COUNT(DISTINCT project.id)::text AS project_count,
      COUNT(DISTINCT publish.id)::text AS publish_count,
      users.created_at,
      users.updated_at
    FROM users
    LEFT JOIN promptoon_platform_admin AS platform ON platform.user_id = users.id
    LEFT JOIN promptoon_studio_member AS studio ON studio.user_id = users.id
    LEFT JOIN promptoon_project AS project ON project.created_by = users.id
    LEFT JOIN promptoon_publish AS publish ON publish.created_by = users.id
  `;
}

function getUserSummaryGroupBy(): string {
  return `
    GROUP BY
      users.id,
      users.login_id,
      users.email,
      users.display_name,
      users.profile_image_url,
      users.discourse_username,
      platform.role,
      studio.role,
      users.created_at,
      users.updated_at
  `;
}

export async function getPlatformAdminRole(db: DbExecutor, userId: string): Promise<PlatformRole | null> {
  const result = await db.query<{ role: PlatformRole }>('SELECT role FROM promptoon_platform_admin WHERE user_id = $1', [userId]);
  return result.rows[0]?.role ?? null;
}

export async function upsertPlatformAdmin(db: DbExecutor, input: { userId: string; grantedBy?: string | null }): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_platform_admin (user_id, role, granted_by)
     VALUES ($1, 'platform_admin', $2)
     ON CONFLICT (user_id) DO UPDATE
       SET role = 'platform_admin',
           granted_by = COALESCE(EXCLUDED.granted_by, promptoon_platform_admin.granted_by),
           updated_at = NOW()`,
    [input.userId, input.grantedBy ?? null]
  );
}

export async function deletePlatformAdmin(db: DbExecutor, userId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM promptoon_platform_admin WHERE user_id = $1', [userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function countPlatformAdmins(db: DbExecutor): Promise<number> {
  const result = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_platform_admin');
  return Number(result.rows[0]?.count ?? 0);
}

export async function getUserLoginId(db: DbExecutor, userId: string): Promise<string | null> {
  const result = await db.query<{ login_id: string }>('SELECT login_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.login_id ?? null;
}

export async function getUserSummaryById(db: DbExecutor, userId: string): Promise<AdminUserSummary | null> {
  const result = await db.query<UserSummaryRow>(
    `${getUserSummarySelect()}
     WHERE users.id = $1
     ${getUserSummaryGroupBy()}`,
    [userId]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listUsers(
  db: DbExecutor,
  input: {
    query?: string;
    role?: AdminUserRoleFilter;
    limit: number;
    offset: number;
  }
): Promise<AdminUserListResponse> {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (input.query?.trim()) {
    values.push(`%${input.query.trim().toLowerCase()}%`);
    filters.push(
      `(LOWER(users.login_id) LIKE $${values.length}
        OR LOWER(COALESCE(users.email, '')) LIKE $${values.length}
        OR LOWER(COALESCE(users.display_name, '')) LIKE $${values.length})`
    );
  }

  if (input.role === 'platform_admin') {
    filters.push('platform.user_id IS NOT NULL');
  } else if (input.role === 'studio_member') {
    filters.push('studio.user_id IS NOT NULL');
  } else if (input.role === 'no_studio') {
    filters.push('studio.user_id IS NULL');
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(input.limit, input.offset);
  const limitParam = values.length - 1;
  const offsetParam = values.length;

  const result = await db.query<UserSummaryRow>(
    `WITH filtered AS (
       ${getUserSummarySelect()}
       ${whereClause}
       ${getUserSummaryGroupBy()}
     )
     SELECT filtered.*, COUNT(*) OVER()::text AS total_count
     FROM filtered
     ORDER BY filtered.created_at DESC, filtered.login_id ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    users: result.rows.map(mapUser),
    total: toNumber(result.rows[0]?.total_count)
  };
}

export async function upsertStudioRole(db: DbExecutor, input: { userId: string; role: StudioRole }): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_studio_member (user_id, role)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET role = EXCLUDED.role`,
    [input.userId, input.role]
  );
}

export async function deleteStudioRole(db: DbExecutor, userId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM promptoon_studio_member WHERE user_id = $1', [userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function listProjects(db: DbExecutor): Promise<AdminProjectListResponse> {
  const result = await db.query<ProjectSummaryRow>(
    `SELECT
       project.id AS project_id,
       project.title,
       project.status,
       project.created_by AS owner_id,
       users.login_id AS owner_login_id,
       COUNT(DISTINCT episode.id)::text AS episode_count,
       COUNT(DISTINCT publish.id)::text AS publish_count,
       COUNT(DISTINCT member.user_id)::text AS member_count,
       MAX(publish.created_at) AS latest_published_at,
       project.created_at,
       project.updated_at
     FROM promptoon_project AS project
     INNER JOIN users ON users.id = project.created_by
     LEFT JOIN promptoon_episode AS episode ON episode.project_id = project.id
     LEFT JOIN promptoon_publish AS publish ON publish.project_id = project.id
     LEFT JOIN promptoon_project_member AS member ON member.project_id = project.id
     GROUP BY project.id, users.login_id
     ORDER BY project.updated_at DESC, project.created_at DESC
     LIMIT 200`
  );

  return {
    projects: result.rows.map((row) => ({
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      ownerId: row.owner_id,
      ownerLoginId: row.owner_login_id,
      episodeCount: toNumber(row.episode_count),
      publishCount: toNumber(row.publish_count),
      memberCount: toNumber(row.member_count),
      latestPublishedAt: toIso(row.latest_published_at),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }))
  };
}

export async function listPublishes(db: DbExecutor): Promise<AdminPublishListResponse> {
  const result = await db.query<PublishSummaryRow>(
    `SELECT
       publish.id AS publish_id,
       publish.project_id,
       project.title AS project_title,
       publish.episode_id,
       episode.title AS episode_title,
       episode.episode_no,
       publish.version_no,
       publish.status,
       publish.created_by,
       users.login_id AS created_by_login_id,
       publish.channel_id,
       publish.series_id,
       feed.id AS feed_item_id,
       discourse.provider_status AS discourse_sync_status,
       discourse.discourse_topic_id,
       publish.created_at
     FROM promptoon_publish AS publish
     INNER JOIN promptoon_project AS project ON project.id = publish.project_id
     INNER JOIN promptoon_episode AS episode ON episode.id = publish.episode_id
     INNER JOIN users ON users.id = publish.created_by
     LEFT JOIN promptoon_feed_item AS feed ON feed.publish_id = publish.id
     LEFT JOIN promptoon_discourse_thread_sync AS discourse ON discourse.publish_id = publish.id
     ORDER BY publish.created_at DESC
     LIMIT 200`
  );

  return {
    publishes: result.rows.map((row) => ({
      publishId: row.publish_id,
      projectId: row.project_id,
      projectTitle: row.project_title,
      episodeId: row.episode_id,
      episodeTitle: row.episode_title,
      episodeNo: row.episode_no,
      versionNo: row.version_no,
      status: row.status,
      createdBy: row.created_by,
      createdByLoginId: row.created_by_login_id,
      channelId: row.channel_id,
      seriesId: row.series_id,
      feedItemId: row.feed_item_id,
      discourseSyncStatus: row.discourse_sync_status,
      discourseTopicId: row.discourse_topic_id,
      createdAt: row.created_at.toISOString()
    }))
  };
}

export async function getDiscourseSummary(db: DbExecutor): Promise<AdminDiscourseSummaryResponse> {
  const [statuses, latest] = await Promise.all([
    db.query<DiscourseStatusRow>(
      `SELECT provider_status AS status, COUNT(*)::text AS count
       FROM promptoon_discourse_thread_sync
       GROUP BY provider_status
       ORDER BY provider_status ASC`
    ),
    db.query<DiscourseItemRow>(
      `SELECT
         sync.publish_id,
         project.title AS project_title,
         episode.title AS episode_title,
         sync.provider_status AS sync_status,
         sync.discourse_topic_id,
         sync.payload_json->>'discoursePostId' AS discourse_post_id,
         sync.last_synced_at,
         sync.payload_json->>'lastError' AS last_error,
         sync.updated_at
       FROM promptoon_discourse_thread_sync AS sync
       INNER JOIN promptoon_publish AS publish ON publish.id = sync.publish_id
       INNER JOIN promptoon_project AS project ON project.id = publish.project_id
       INNER JOIN promptoon_episode AS episode ON episode.id = publish.episode_id
       ORDER BY sync.updated_at DESC
       LIMIT 50`
    )
  ]);

  return {
    statuses: statuses.rows.map((row) => ({
      status: row.status,
      count: toNumber(row.count)
    })),
    latest: latest.rows.map((row) => ({
      publishId: row.publish_id,
      projectTitle: row.project_title,
      episodeTitle: row.episode_title,
      syncStatus: row.sync_status,
      discourseTopicId: row.discourse_topic_id,
      discoursePostId: row.discourse_post_id,
      lastSyncedAt: toIso(row.last_synced_at),
      lastError: row.last_error,
      updatedAt: row.updated_at.toISOString()
    }))
  };
}

export async function getTelemetrySummary(db: DbExecutor): Promise<AdminTelemetrySummaryResponse> {
  const [total, events, domains] = await Promise.all([
    db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_telemetry_event'),
    db.query<TelemetryEventRow>(
      `SELECT event_name, COUNT(*)::text AS count, MAX(created_at) AS latest_at
       FROM promptoon_telemetry_event
       GROUP BY event_name
       ORDER BY COUNT(*) DESC, event_name ASC
       LIMIT 25`
    ),
    db.query<TelemetryDomainRow>(
      `SELECT
         CASE
           WHEN event_name LIKE 'feed_%' THEN 'feed'
           WHEN event_name LIKE 'viewer_%' THEN 'viewer'
           WHEN event_name LIKE 'channel_%' THEN 'channel'
           WHEN event_name LIKE 'studio_%' THEN 'studio'
           WHEN event_name LIKE 'community_%' THEN 'community'
           ELSE 'core'
         END AS domain,
         COUNT(*)::text AS count
       FROM promptoon_telemetry_event
       GROUP BY domain
       ORDER BY COUNT(*) DESC, domain ASC`
    )
  ]);

  return {
    totalEvents: Number(total.rows[0]?.count ?? 0),
    events: events.rows.map((row) => ({
      eventName: row.event_name,
      count: toNumber(row.count),
      latestAt: toIso(row.latest_at)
    })),
    domains: domains.rows.map((row) => ({
      domain: row.domain,
      count: toNumber(row.count)
    }))
  };
}
