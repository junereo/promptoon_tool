import type {
  ChannelHome,
  ChannelProfile,
  ChannelSubscriptionStateResponse,
  CommunityComment,
  CommunityCommentStatus,
  CommunityThreadSyncStatus,
  ContentInteractionState,
  DiscourseThreadSyncResponse,
  FeedItem,
  FeedItemMetrics,
  Project,
  ProjectRole,
  Publish,
  PublishManifest,
  RelatedShort,
  StudioProjectKind,
  StudioProjectStatus,
  TelemetryEventPayload,
  TelemetryEventType,
  ViewerInteractionStateResponse
} from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import type { DbExecutor } from '../../db';
import { buildFeedItemAccessPredicate, buildFeedItemExperimentalPredicate } from '../experimental/experimental.repository';

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  kind: StudioProjectKind;
  status: StudioProjectStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface PublishRow {
  id: string;
  project_id: string;
  episode_id: string;
  version_no: number;
  status: Publish['status'];
  manifest: PublishManifest;
  created_by: string;
  created_at: Date;
}

export interface ProductChannelRow {
  id: string;
  project_id: string | null;
  owner_user_id: string | null;
  slug: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_default: boolean;
  visibility: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProductSeriesRow {
  id: string;
  project_id: string;
  channel_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  status: 'draft' | 'ongoing' | 'completed' | 'paused';
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface FeedCursorInput {
  createdAt: string;
  publishId: string;
}

type FeedProjectionOrder = 'published' | 'trending';

interface FeedItemProjectionRow {
  id: string;
  publish_id: string | null;
  movingtoon_publish_id: string | null;
  project_id: string;
  channel_id: string | null;
  series_id: string | null;
  episode_id: string | null;
  metrics_json: FeedItemMetrics | null;
  payload_json: FeedItem;
  published_at: Date;
  is_experimental: boolean | null;
}

interface ResolvedFeedItemProjectionRow extends FeedItemProjectionRow {
  resolved_publish_id: string;
}

interface BookmarkedFeedItemProjectionRow extends FeedItemProjectionRow {
  bookmarked_at: Date;
  bookmark_publish_id: string;
}

interface ContentInteractionStateRow {
  publish_id: string;
  content_type: 'promptoon' | 'short_drama';
  liked: boolean;
  bookmarked: boolean;
  metrics_json: FeedItemMetrics | null;
}

interface ViewerInteractionStateRow extends ContentInteractionStateRow {
  channel_id: string | null;
  subscribed_to_channel: boolean;
}

export interface ProductPublishProjectionContextRow {
  publish_id: string;
  project_id: string;
  channel_id: string | null;
  series_id: string | null;
  episode_id: string;
  feed_item_id: string | null;
}

export interface MovingtoonPublishProjectionContextRow {
  publish_id: string;
  project_id: string;
  channel_id: string | null;
  series_id: string | null;
  episode_id: string;
  feed_item_id: string | null;
}

interface ChannelHomeProjectionRow {
  profile_json: ChannelHome['profile'];
  featured_series_json: ChannelHome['featuredSeries'];
  latest_episodes_json: ChannelHome['latestEpisodes'];
  latest_shorts_json: ChannelHome['latestShorts'];
  community_meta_json: ChannelHome['communityMeta'] | null;
}

export interface ProductCommentsMetaRow {
  publish_id: string | null;
  comment_count: number;
  latest_comment_at: Date | null;
  discussion_url: string | null;
}

interface RelatedShortRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_sec: number;
  publish_id: string | null;
  movingtoon_publish_id: string | null;
  channel_slug: string | null;
}

interface ViewerEventInsertRow {
  id: string;
}

interface CommunityCommentRow {
  id: string;
  publish_id: string | null;
  movingtoon_publish_id: string | null;
  discussion_id: string | null;
  user_id: string | null;
  body: string;
  status: CommunityCommentStatus;
  moderation_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DiscourseThreadSyncRow {
  publish_id: string;
  discourse_topic_id: string | null;
  provider_status: CommunityThreadSyncStatus;
  payload_json: Record<string, unknown> | null;
  last_synced_at: Date | null;
}

interface ProjectDiscussionRow {
  project_id: string;
  discourse_topic_id: string | null;
  provider_status: CommunityThreadSyncStatus;
  discussion_url: string | null;
  comment_count: number;
  latest_comment_at: Date | null;
  payload_json: Record<string, unknown> | null;
  last_synced_at: Date | null;
}

interface DiscourseTopicContextRow {
  project_id: string;
  publish_id: string | null;
  episode_id: string | null;
  episode_title: string | null;
  discourse_topic_id: string;
  source: 'project' | 'episode';
}

export interface ProductUserCommunityIdentity {
  id: string;
  loginId: string;
  email: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  discourseUsername: string | null;
}

export interface FeedProjectionInput {
  publish: Publish;
  feedItem: FeedItem;
  channel: ProductChannelRow;
  series: ProductSeriesRow;
}

export interface ProductProjectDiscussion {
  projectId: string;
  discourseTopicId: string | null;
  status: CommunityThreadSyncStatus;
  discussionUrl: string | null;
  commentCount: number;
  latestCommentAt: string | null;
  payload: Record<string, unknown>;
  lastSyncedAt: string | null;
}

export interface ProductDiscourseTopicContext {
  projectId: string;
  publishId: string | null;
  episodeId: string | null;
  episodeTitle: string | null;
  discourseTopicId: string;
  source: 'project' | 'episode';
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    kind: row.kind,
    status: row.status,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapPublish(row: PublishRow): Publish {
  return {
    id: row.id,
    projectId: row.project_id,
    episodeId: row.episode_id,
    versionNo: row.version_no,
    status: row.status,
    manifest: row.manifest,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at)
  };
}

function mapCommunityComment(row: CommunityCommentRow): CommunityComment {
  return {
    id: row.id,
    publishId: row.publish_id ?? row.movingtoon_publish_id ?? '',
    discussionId: row.discussion_id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    moderationReason: row.moderation_reason,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapDiscourseThreadSync(row: DiscourseThreadSyncRow): DiscourseThreadSyncResponse {
  return {
    publishId: row.publish_id,
    provider: 'discourse',
    status: row.provider_status,
    discourseTopicId: row.discourse_topic_id,
    lastSyncedAt: row.last_synced_at ? toIsoString(row.last_synced_at) : null,
    payload: row.payload_json ?? {}
  };
}

function mapProjectDiscussion(row: ProjectDiscussionRow): ProductProjectDiscussion {
  return {
    projectId: row.project_id,
    discourseTopicId: row.discourse_topic_id,
    status: row.provider_status,
    discussionUrl: row.discussion_url,
    commentCount: row.comment_count,
    latestCommentAt: row.latest_comment_at ? toIsoString(row.latest_comment_at) : null,
    payload: row.payload_json ?? {},
    lastSyncedAt: row.last_synced_at ? toIsoString(row.last_synced_at) : null
  };
}

function mapDiscourseTopicContext(row: DiscourseTopicContextRow): ProductDiscourseTopicContext {
  return {
    projectId: row.project_id,
    publishId: row.publish_id,
    episodeId: row.episode_id,
    episodeTitle: row.episode_title,
    discourseTopicId: row.discourse_topic_id,
    source: row.source
  };
}

function mapChannelProfile(row: ProductChannelRow, counts?: Partial<ChannelProfile>): ChannelProfile {
  return {
    id: row.id,
    slug: row.slug,
    ownerLoginId: counts?.ownerLoginId ?? null,
    displayName: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    bio: row.bio,
    isVerified: row.is_verified,
    subscriberCount: counts?.subscriberCount ?? 0,
    likeCount: counts?.likeCount ?? 0,
    seriesCount: counts?.seriesCount ?? 0,
    episodeCount: counts?.episodeCount ?? 0,
    shortCount: counts?.shortCount ?? 0
  };
}

function normalizeFeedMetrics(metrics: Partial<FeedItemMetrics> | null | undefined): FeedItemMetrics {
  return {
    views: Number(metrics?.views ?? 0),
    likes: Number(metrics?.likes ?? 0),
    comments: Number(metrics?.comments ?? 0),
    shares: Number(metrics?.shares ?? 0)
  };
}

function slugify(value: string, fallbackId: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${normalized || 'channel'}-${fallbackId.slice(0, 8)}`;
}

interface ChannelOwnerRow {
  id: string;
  login_id: string;
  display_name: string | null;
}

function getChannelOwnerDisplayName(owner: ChannelOwnerRow): string {
  return owner.display_name?.trim() || 'Promptoon Creator';
}

export async function getProjectById(db: DbExecutor, projectId: string): Promise<Project | null> {
  const result = await db.query<ProjectRow>('SELECT * FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function getProjectOwnerId(db: DbExecutor, projectId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>('SELECT created_by FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0]?.created_by ?? null;
}

export async function getProjectMemberRole(db: DbExecutor, input: { projectId: string; userId: string }): Promise<ProjectRole | null> {
  const result = await db.query<{ role: ProjectRole }>(
    'SELECT role FROM promptoon_project_member WHERE project_id = $1 AND user_id = $2',
    [input.projectId, input.userId]
  );

  return result.rows[0]?.role ?? null;
}

export async function getEpisodeProjectId(db: DbExecutor, episodeId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>('SELECT project_id FROM promptoon_episode WHERE id = $1', [episodeId]);
  return result.rows[0]?.project_id ?? null;
}

export async function getCutProjectId(db: DbExecutor, cutId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>(
    `SELECT episode.project_id
     FROM promptoon_cut AS cut
     INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
     WHERE cut.id = $1`,
    [cutId]
  );

  return result.rows[0]?.project_id ?? null;
}

export async function getChoiceProjectId(db: DbExecutor, choiceId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>(
    `SELECT episode.project_id
     FROM promptoon_choice AS choice
     INNER JOIN promptoon_cut AS cut ON cut.id = choice.cut_id
     INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
     WHERE choice.id = $1`,
    [choiceId]
  );

  return result.rows[0]?.project_id ?? null;
}

export async function getPublishById(db: DbExecutor, publishId: string): Promise<Publish | null> {
  const result = await db.query<PublishRow>('SELECT * FROM promptoon_publish WHERE id = $1', [publishId]);
  return result.rows[0] ? mapPublish(result.rows[0]) : null;
}

export async function listLatestPublishesForProjectionRebuild(db: DbExecutor, projectId?: string): Promise<Publish[]> {
  const result = await db.query<PublishRow>(
    `WITH ranked_publishes AS (
       SELECT
         publish.*,
         ROW_NUMBER() OVER (
           PARTITION BY publish.episode_id
           ORDER BY publish.version_no DESC, publish.created_at DESC, publish.id DESC
         ) AS publish_rank
       FROM promptoon_publish AS publish
       WHERE publish.status = 'published'
         AND ($1::uuid IS NULL OR publish.project_id = $1::uuid)
     )
     SELECT
       id,
       project_id,
       episode_id,
       version_no,
       status,
       manifest,
       created_by,
       created_at
     FROM ranked_publishes
     WHERE publish_rank = 1
     ORDER BY created_at DESC, id DESC`,
    [projectId ?? null]
  );

  return result.rows.map(mapPublish);
}

export async function ensureDefaultChannelForProject(
  db: DbExecutor,
  project: Project,
  ownerUserId: string
): Promise<ProductChannelRow> {
  const channelOwnerId = project.createdBy || ownerUserId;
  const existing = await db.query<ProductChannelRow>(
    `SELECT *
     FROM promptoon_channel
     WHERE owner_user_id = $1 AND is_default = TRUE
     ORDER BY created_at ASC
     LIMIT 1`,
    [channelOwnerId]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const ownerResult = await db.query<ChannelOwnerRow>(
    'SELECT id, login_id, display_name FROM users WHERE id = $1',
    [channelOwnerId]
  );
  const owner = ownerResult.rows[0];
  const displayName = owner ? getChannelOwnerDisplayName(owner) : project.title;
  const slug = slugify(displayName, channelOwnerId);
  const result = await db.query<ProductChannelRow>(
    `INSERT INTO promptoon_channel (project_id, owner_user_id, slug, display_name, handle, avatar_url, bio, is_default)
     VALUES (NULL, $1, $2, $3, $4, $5, NULL, TRUE)
     ON CONFLICT (slug) DO UPDATE
       SET project_id = NULL,
           owner_user_id = EXCLUDED.owner_user_id,
           display_name = EXCLUDED.display_name,
           handle = EXCLUDED.handle,
           avatar_url = COALESCE(promptoon_channel.avatar_url, EXCLUDED.avatar_url),
           is_default = TRUE,
           updated_at = NOW()
     RETURNING *`,
    [channelOwnerId, slug, displayName, `@${slug}`, null]
  );

  return result.rows[0];
}

export async function ensureDefaultChannelForOwner(db: DbExecutor, ownerUserId: string): Promise<ProductChannelRow> {
  const existing = await db.query<ProductChannelRow>(
    `SELECT *
     FROM promptoon_channel
     WHERE owner_user_id = $1 AND is_default = TRUE
     ORDER BY created_at ASC
     LIMIT 1`,
    [ownerUserId]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const ownerResult = await db.query<ChannelOwnerRow>(
    'SELECT id, login_id, display_name FROM users WHERE id = $1',
    [ownerUserId]
  );
  const owner = ownerResult.rows[0];
  const displayName = owner ? getChannelOwnerDisplayName(owner) : 'Promptoon Creator';
  const slug = slugify(displayName, ownerUserId);
  const result = await db.query<ProductChannelRow>(
    `INSERT INTO promptoon_channel (project_id, owner_user_id, slug, display_name, handle, avatar_url, bio, is_default)
     VALUES (NULL, $1, $2, $3, $4, $5, NULL, TRUE)
     ON CONFLICT (slug) DO UPDATE
       SET project_id = NULL,
           owner_user_id = EXCLUDED.owner_user_id,
           display_name = EXCLUDED.display_name,
           handle = EXCLUDED.handle,
           avatar_url = COALESCE(promptoon_channel.avatar_url, EXCLUDED.avatar_url),
           is_default = TRUE,
           updated_at = NOW()
     RETURNING *`,
    [ownerUserId, slug, displayName, `@${slug}`, null]
  );

  return result.rows[0];
}

export async function updateChannelBannerUrl(
  db: DbExecutor,
  input: {
    channelId: string;
    bannerUrl: string | null;
  }
): Promise<ProductChannelRow | null> {
  const result = await db.query<ProductChannelRow>(
    `UPDATE promptoon_channel
     SET banner_url = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.channelId, input.bannerUrl]
  );

  return result.rows[0] ?? null;
}

export async function updateChannelAvatarUrl(
  db: DbExecutor,
  input: {
    channelId: string;
    avatarUrl: string | null;
  }
): Promise<ProductChannelRow | null> {
  const result = await db.query<ProductChannelRow>(
    `UPDATE promptoon_channel
     SET avatar_url = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.channelId, input.avatarUrl]
  );

  return result.rows[0] ?? null;
}

export async function updateChannelProfile(
  db: DbExecutor,
  input: {
    bio: string | null;
    channelId: string;
    displayName: string;
  }
): Promise<ProductChannelRow | null> {
  const result = await db.query<ProductChannelRow>(
    `UPDATE promptoon_channel
     SET display_name = $2,
         bio = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.channelId, input.displayName, input.bio]
  );

  return result.rows[0] ?? null;
}

export async function syncFeedItemChannelProfilePayload(db: DbExecutor, channelId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_feed_item AS item
     SET payload_json = jsonb_set(
           jsonb_set(
             item.payload_json,
             '{channelName}',
             to_jsonb(channel.display_name),
             true
           ),
           '{channelAvatarUrl}',
           COALESCE(to_jsonb(channel.avatar_url), 'null'::jsonb),
           true
         ),
         updated_at = NOW()
     FROM promptoon_channel AS channel
     WHERE item.channel_id = channel.id
       AND channel.id = $1`,
    [channelId]
  );
}

export async function ensureDefaultSeriesForProject(
  db: DbExecutor,
  input: {
    project: Project;
    channelId: string;
  }
): Promise<ProductSeriesRow> {
  const existing = await db.query<ProductSeriesRow>(
    'SELECT * FROM promptoon_series WHERE project_id = $1 ORDER BY sort_order, created_at LIMIT 1',
    [input.project.id]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].channel_id !== input.channelId) {
      const updated = await db.query<ProductSeriesRow>(
        `UPDATE promptoon_series
         SET channel_id = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, input.channelId]
      );
      return updated.rows[0];
    }

    return existing.rows[0];
  }

  const result = await db.query<ProductSeriesRow>(
    `INSERT INTO promptoon_series (project_id, channel_id, title, slug, description, cover_image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ongoing')
     ON CONFLICT (project_id, slug) DO UPDATE
       SET updated_at = NOW()
     RETURNING *`,
    [
      input.project.id,
      input.channelId,
      input.project.title,
      slugify(input.project.title, input.project.id),
      input.project.description,
      input.project.thumbnailUrl
    ]
  );

  return result.rows[0];
}

export async function upsertFeedItemProjection(db: DbExecutor, input: FeedProjectionInput): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_feed_item (
       publish_id,
       project_id,
       channel_id,
       series_id,
       episode_id,
       item_type,
       title,
       description,
       cover_image_url,
       start_cut_snapshot_json,
       choice_count,
       entry_json,
       payload_json,
       published_at
     )
     VALUES ($1, $2, $3, $4, $5, 'promptoon', $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (episode_id) DO UPDATE
       SET publish_id = EXCLUDED.publish_id,
           project_id = EXCLUDED.project_id,
           channel_id = EXCLUDED.channel_id,
           series_id = EXCLUDED.series_id,
           item_type = EXCLUDED.item_type,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           cover_image_url = EXCLUDED.cover_image_url,
           start_cut_snapshot_json = EXCLUDED.start_cut_snapshot_json,
           choice_count = EXCLUDED.choice_count,
           entry_json = EXCLUDED.entry_json,
           payload_json = EXCLUDED.payload_json,
           published_at = EXCLUDED.published_at,
           updated_at = NOW()`,
    [
      input.publish.id,
      input.publish.projectId,
      input.channel.id,
      input.series.id,
      input.publish.episodeId,
      input.feedItem.episodeTitle,
      input.feedItem.projectTitle,
      input.feedItem.coverImageUrl,
      JSON.stringify(input.feedItem.startCut),
      input.feedItem.startChoices.length,
      JSON.stringify({ kind: 'viewer', href: `/v/${input.publish.id}` }),
      JSON.stringify(input.feedItem),
      input.publish.createdAt
    ]
  );
}

export async function deleteFeedItemProjectionForEpisode(db: DbExecutor, episodeId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_feed_item WHERE episode_id = $1', [episodeId]);
}

export async function listFeedItemProjections(
  db: DbExecutor,
  input: {
    cursor?: FeedCursorInput;
    itemTypes?: string[];
    limit: number;
    orderBy?: FeedProjectionOrder;
    query?: string;
    userId?: string;
  }
): Promise<Array<{ id: string; publishedAt: string; item: FeedItem }>> {
  const values: unknown[] = [];
  const whereClauses: string[] = [];
  if (input.cursor) {
    values.push(input.cursor.createdAt, input.cursor.publishId);
    whereClauses.push(`(published_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  if (input.itemTypes && input.itemTypes.length > 0) {
    values.push(input.itemTypes);
    whereClauses.push(`item_type = ANY($${values.length}::text[])`);
  }
  if (input.query?.trim()) {
    values.push(`%${input.query.trim()}%`);
    whereClauses.push(`(
      title ILIKE $${values.length}
      OR COALESCE(description, '') ILIKE $${values.length}
      OR COALESCE(payload_json->>'projectTitle', '') ILIKE $${values.length}
      OR COALESCE(payload_json->>'episodeTitle', '') ILIKE $${values.length}
      OR COALESCE(payload_json->>'channelName', '') ILIKE $${values.length}
    )`);
  }
  const accessUserParam = input.userId ? `$${values.push(input.userId)}` : undefined;
  whereClauses.push(buildFeedItemAccessPredicate('promptoon_feed_item', accessUserParam));
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderBy =
    input.orderBy === 'trending'
      ? `ORDER BY (
           ranking_score
           + COALESCE((metrics_json->>'views')::double precision, 0) * 0.2
           + COALESCE((metrics_json->>'likes')::double precision, 0) * 3
           + COALESCE((metrics_json->>'comments')::double precision, 0) * 2
           + COALESCE((metrics_json->>'shares')::double precision, 0) * 4
         ) DESC, published_at DESC, id DESC`
      : 'ORDER BY published_at DESC, id DESC';

  values.push(input.limit);

  const result = await db.query<FeedItemProjectionRow>(
    `SELECT id, publish_id, movingtoon_publish_id, project_id, channel_id, series_id, episode_id, metrics_json, payload_json, published_at,
       ${buildFeedItemExperimentalPredicate('promptoon_feed_item', accessUserParam)} AS is_experimental
     FROM promptoon_feed_item
     ${whereClause}
     ${orderBy}
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map(mapFeedItemProjectionRow);
}

export async function listFeedItemProjectionsByPublishIds(
  db: DbExecutor,
  publishIds: string[],
  userId?: string
): Promise<Array<{ publishId: string; id: string; publishedAt: string; item: FeedItem }>> {
  if (publishIds.length === 0) {
    return [];
  }

  const values: unknown[] = [publishIds];
  const accessUserParam = userId ? `$${values.push(userId)}` : undefined;
  const result = await db.query<ResolvedFeedItemProjectionRow>(
    `SELECT
       id,
       publish_id,
       movingtoon_publish_id,
       COALESCE(publish_id, movingtoon_publish_id) AS resolved_publish_id,
       project_id,
       channel_id,
       series_id,
       episode_id,
       metrics_json,
       payload_json,
       published_at,
       ${buildFeedItemExperimentalPredicate('promptoon_feed_item', accessUserParam)} AS is_experimental
     FROM promptoon_feed_item
     WHERE COALESCE(publish_id, movingtoon_publish_id) = ANY($1::uuid[])
       AND ${buildFeedItemAccessPredicate('promptoon_feed_item', accessUserParam)}`,
    values
  );

  return result.rows.map((row) => ({
    publishId: row.resolved_publish_id,
    ...mapFeedItemProjectionRow(row)
  }));
}

export async function listFeedItemProjectionsByProjectId(
  db: DbExecutor,
  input: {
    limit: number;
    projectId: string;
    userId?: string;
  }
): Promise<Array<{ publishId: string; id: string; publishedAt: string; item: FeedItem }>> {
  const values: unknown[] = [input.projectId];
  const accessUserParam = input.userId ? `$${values.push(input.userId)}` : undefined;
  values.push(input.limit);

  const result = await db.query<ResolvedFeedItemProjectionRow>(
    `SELECT
       id,
       publish_id,
       movingtoon_publish_id,
       COALESCE(publish_id, movingtoon_publish_id) AS resolved_publish_id,
       project_id,
       channel_id,
       series_id,
       episode_id,
       metrics_json,
       payload_json,
       published_at,
       ${buildFeedItemExperimentalPredicate('promptoon_feed_item', accessUserParam)} AS is_experimental
     FROM promptoon_feed_item
     WHERE project_id = $1
       AND COALESCE(publish_id, movingtoon_publish_id) IS NOT NULL
       AND ${buildFeedItemAccessPredicate('promptoon_feed_item', accessUserParam)}
     ORDER BY published_at DESC, id DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map((row) => ({
    publishId: row.resolved_publish_id,
    ...mapFeedItemProjectionRow(row)
  }));
}

export async function countFeedItemProjectionsByProjectId(
  db: DbExecutor,
  input: {
    projectId: string;
    userId?: string;
  }
): Promise<number> {
  const values: unknown[] = [input.projectId];
  const accessUserParam = input.userId ? `$${values.push(input.userId)}` : undefined;
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM promptoon_feed_item
     WHERE project_id = $1
       AND COALESCE(publish_id, movingtoon_publish_id) IS NOT NULL
       AND ${buildFeedItemAccessPredicate('promptoon_feed_item', accessUserParam)}`,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
}

function mapFeedItemProjectionRow(row: FeedItemProjectionRow): { id: string; publishedAt: string; item: FeedItem } {
  const isExperimental = Boolean(row.is_experimental ?? row.payload_json.isExperimental);

  return {
    id: row.id,
    publishedAt: toIsoString(row.published_at),
    item: {
      ...row.payload_json,
      metrics: normalizeFeedMetrics(row.metrics_json ?? row.payload_json.metrics),
      ...(isExperimental ? { isExperimental: true } : {})
    }
  };
}

export async function listBookmarkedFeedItemProjections(
  db: DbExecutor,
  input: {
    cursor?: FeedCursorInput;
    limit: number;
    userId: string;
  }
): Promise<Array<{ id: string; publishedAt: string; cursorAt: string; item: FeedItem }>> {
  const values: unknown[] = [input.userId];
  const whereClauses: string[] = [];

  if (input.cursor) {
    values.push(input.cursor.createdAt, input.cursor.publishId);
    whereClauses.push(`(bookmarked.bookmarked_at, bookmarked.bookmark_publish_id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  values.push(input.limit);

  const result = await db.query<BookmarkedFeedItemProjectionRow>(
    `WITH bookmarked AS (
       SELECT
         bookmark.publish_id AS publish_id,
         NULL::uuid AS movingtoon_publish_id,
         bookmark.publish_id AS bookmark_publish_id,
         bookmark.created_at AS bookmarked_at
       FROM promptoon_user_bookmark AS bookmark
       WHERE bookmark.user_id = $1
       UNION ALL
       SELECT
         NULL::uuid AS publish_id,
         bookmark.movingtoon_publish_id AS movingtoon_publish_id,
         bookmark.movingtoon_publish_id AS bookmark_publish_id,
         bookmark.created_at AS bookmarked_at
       FROM promptoon_user_movingtoon_bookmark AS bookmark
       WHERE bookmark.user_id = $1
     )
     SELECT
       item.id,
       item.publish_id,
       item.movingtoon_publish_id,
       item.project_id,
       item.channel_id,
       item.series_id,
       item.episode_id,
       item.metrics_json,
       item.payload_json,
       item.published_at,
       ${buildFeedItemExperimentalPredicate('item', '$1')} AS is_experimental,
       bookmarked.bookmarked_at,
       bookmarked.bookmark_publish_id::text AS bookmark_publish_id
     FROM bookmarked
     INNER JOIN promptoon_feed_item AS item
       ON item.publish_id = bookmarked.publish_id
       OR item.movingtoon_publish_id = bookmarked.movingtoon_publish_id
     ${whereClause ? `${whereClause} AND` : 'WHERE'} ${buildFeedItemAccessPredicate('item', '$1')}
     ORDER BY bookmarked.bookmarked_at DESC, bookmarked.bookmark_publish_id DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map((row) => ({
    ...mapFeedItemProjectionRow(row),
    cursorAt: toIsoString(row.bookmarked_at),
    id: row.bookmark_publish_id
  }));
}

export async function getFeedItemByPublicPublishId(db: DbExecutor, publishId: string, userId?: string): Promise<FeedItem | null> {
  const values: unknown[] = [publishId];
  const accessUserParam = userId ? `$${values.push(userId)}` : undefined;
  const result = await db.query<FeedItemProjectionRow>(
    `SELECT id, publish_id, movingtoon_publish_id, project_id, channel_id, series_id, episode_id, metrics_json, payload_json, published_at,
       ${buildFeedItemExperimentalPredicate('promptoon_feed_item', accessUserParam)} AS is_experimental
     FROM promptoon_feed_item
     WHERE (publish_id = $1 OR movingtoon_publish_id = $1)
       AND ${buildFeedItemAccessPredicate('promptoon_feed_item', accessUserParam)}
     LIMIT 1`,
    values
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapFeedItemProjectionRow(row).item;
}

export async function listExperimentalFeedItemsForUser(db: DbExecutor, userId: string): Promise<FeedItem[]> {
  const result = await db.query<FeedItemProjectionRow>(
    `SELECT DISTINCT
       item.id,
       item.publish_id,
       item.movingtoon_publish_id,
       item.project_id,
       item.channel_id,
       item.series_id,
       item.episode_id,
       item.metrics_json,
       item.payload_json,
       item.published_at,
       TRUE AS is_experimental
     FROM promptoon_feed_item AS item
     WHERE COALESCE(item.publish_id, item.movingtoon_publish_id) IS NOT NULL
       AND ${buildFeedItemExperimentalPredicate('item', '$1')}
     ORDER BY item.published_at DESC, item.id DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map((row) => mapFeedItemProjectionRow(row).item);
}

export async function getPublishProjectionContext(db: DbExecutor, publishId: string): Promise<ProductPublishProjectionContextRow | null> {
  const result = await db.query<ProductPublishProjectionContextRow>(
    `SELECT
       publish.id AS publish_id,
       publish.project_id,
       publish.channel_id,
       publish.series_id,
       publish.episode_id,
       item.id AS feed_item_id
     FROM promptoon_publish AS publish
     LEFT JOIN promptoon_feed_item AS item ON item.publish_id = publish.id
     WHERE publish.id = $1`,
    [publishId]
  );

  return result.rows[0] ?? null;
}

export async function getMovingtoonPublishProjectionContext(
  db: DbExecutor,
  publishId: string
): Promise<MovingtoonPublishProjectionContextRow | null> {
  const result = await db.query<MovingtoonPublishProjectionContextRow>(
    `SELECT
       publish.id AS publish_id,
       publish.project_id,
       publish.channel_id,
       publish.series_id,
       publish.episode_id,
       item.id AS feed_item_id
     FROM promptoon_movingtoon_publish AS publish
     LEFT JOIN promptoon_feed_item AS item ON item.movingtoon_publish_id = publish.id
     WHERE publish.id = $1`,
    [publishId]
  );

  return result.rows[0] ?? null;
}

export async function listContentInteractionStates(
  db: DbExecutor,
  input: {
    publishIds: string[];
    userId: string;
  }
): Promise<ContentInteractionState[]> {
  if (input.publishIds.length === 0) {
    return [];
  }

  const result = await db.query<ContentInteractionStateRow>(
    `WITH requested AS (
       SELECT unnest($1::uuid[]) AS publish_id
     )
     SELECT
       requested.publish_id::text AS publish_id,
       CASE WHEN promptoon_publish.id IS NOT NULL THEN 'promptoon' ELSE 'short_drama' END AS content_type,
       CASE
         WHEN promptoon_publish.id IS NOT NULL THEN EXISTS (
           SELECT 1
           FROM promptoon_user_like AS user_like
           WHERE user_like.user_id = $2
             AND user_like.publish_id = requested.publish_id
         )
         ELSE EXISTS (
           SELECT 1
           FROM promptoon_user_movingtoon_like AS user_like
           WHERE user_like.user_id = $2
             AND user_like.movingtoon_publish_id = requested.publish_id
         )
       END AS liked,
       CASE
         WHEN promptoon_publish.id IS NOT NULL THEN EXISTS (
           SELECT 1
           FROM promptoon_user_bookmark AS bookmark
           WHERE bookmark.user_id = $2
             AND bookmark.publish_id = requested.publish_id
         )
         ELSE EXISTS (
           SELECT 1
           FROM promptoon_user_movingtoon_bookmark AS bookmark
           WHERE bookmark.user_id = $2
             AND bookmark.movingtoon_publish_id = requested.publish_id
         )
       END AS bookmarked,
       COALESCE(item.metrics_json, item.payload_json->'metrics', '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb) AS metrics_json
     FROM requested
     LEFT JOIN promptoon_publish ON promptoon_publish.id = requested.publish_id
     LEFT JOIN promptoon_movingtoon_publish AS movingtoon_publish ON movingtoon_publish.id = requested.publish_id
     LEFT JOIN promptoon_feed_item AS item
       ON item.publish_id = requested.publish_id
       OR item.movingtoon_publish_id = requested.publish_id
     WHERE promptoon_publish.id IS NOT NULL
        OR movingtoon_publish.id IS NOT NULL
     ORDER BY array_position($1::uuid[], requested.publish_id)`,
    [input.publishIds, input.userId]
  );

  return result.rows.map((row) => ({
    publishId: row.publish_id,
    contentType: row.content_type,
    liked: row.liked,
    bookmarked: row.bookmarked,
    metrics: normalizeFeedMetrics(row.metrics_json)
  }));
}

export async function getViewerInteractionState(
  db: DbExecutor,
  input: {
    publishId: string;
    userId: string;
  }
): Promise<ViewerInteractionStateResponse | null> {
  const result = await db.query<ViewerInteractionStateRow>(
    `SELECT
       publish.id::text AS publish_id,
       publish.channel_id::text AS channel_id,
       EXISTS (
         SELECT 1
         FROM promptoon_user_like AS user_like
         WHERE user_like.user_id = $2
           AND user_like.publish_id = publish.id
       ) AS liked,
       EXISTS (
         SELECT 1
         FROM promptoon_user_bookmark AS bookmark
         WHERE bookmark.user_id = $2
           AND bookmark.publish_id = publish.id
       ) AS bookmarked,
       CASE
         WHEN publish.channel_id IS NULL THEN FALSE
         ELSE EXISTS (
           SELECT 1
           FROM promptoon_user_subscription AS subscription
           WHERE subscription.user_id = $2
             AND subscription.channel_id = publish.channel_id
         )
       END AS subscribed_to_channel,
       COALESCE(item.metrics_json, item.payload_json->'metrics', '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb) AS metrics_json
     FROM promptoon_publish AS publish
     LEFT JOIN promptoon_feed_item AS item ON item.publish_id = publish.id
     WHERE publish.id = $1`,
    [input.publishId, input.userId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    publishId: row.publish_id,
    liked: row.liked,
    bookmarked: row.bookmarked,
    metrics: normalizeFeedMetrics(row.metrics_json),
    channelId: row.channel_id,
    subscribedToChannel: row.subscribed_to_channel
  };
}

export async function getChannelSubscriptionState(
  db: DbExecutor,
  input: {
    channelId: string;
    userId: string;
  }
): Promise<ChannelSubscriptionStateResponse | null> {
  const result = await db.query<{
    channel_id: string;
    subscribed: boolean;
    subscriber_count: string;
  }>(
    `SELECT
       channel.id::text AS channel_id,
       EXISTS (
         SELECT 1
         FROM promptoon_user_subscription AS subscription
         WHERE subscription.user_id = $2
           AND subscription.channel_id = channel.id
       ) AS subscribed,
       (SELECT COUNT(*) FROM promptoon_user_subscription WHERE channel_id = channel.id)::text AS subscriber_count
     FROM promptoon_channel AS channel
     WHERE channel.id = $1`,
    [input.channelId, input.userId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    channelId: row.channel_id,
    subscribed: row.subscribed,
    subscriberCount: Number(row.subscriber_count)
  };
}

export async function upsertUserLike(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_user_like (user_id, publish_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, publish_id) DO NOTHING`,
    [userId, publishId]
  );
}

export async function deleteUserLike(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_user_like WHERE user_id = $1 AND publish_id = $2', [userId, publishId]);
}

export async function upsertUserMovingtoonLike(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_user_movingtoon_like (user_id, movingtoon_publish_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, movingtoon_publish_id) DO NOTHING`,
    [userId, publishId]
  );
}

export async function deleteUserMovingtoonLike(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_user_movingtoon_like WHERE user_id = $1 AND movingtoon_publish_id = $2', [
    userId,
    publishId
  ]);
}

export async function upsertUserBookmark(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_user_bookmark (user_id, publish_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, publish_id) DO NOTHING`,
    [userId, publishId]
  );
}

export async function deleteUserBookmark(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_user_bookmark WHERE user_id = $1 AND publish_id = $2', [userId, publishId]);
}

export async function upsertUserMovingtoonBookmark(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_user_movingtoon_bookmark (user_id, movingtoon_publish_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, movingtoon_publish_id) DO NOTHING`,
    [userId, publishId]
  );
}

export async function deleteUserMovingtoonBookmark(db: DbExecutor, publishId: string, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_user_movingtoon_bookmark WHERE user_id = $1 AND movingtoon_publish_id = $2', [
    userId,
    publishId
  ]);
}

export async function refreshFeedItemLikeMetrics(db: DbExecutor, publishId: string): Promise<ProductPublishProjectionContextRow | null> {
  const context = await getPublishProjectionContext(db, publishId);
  if (!context) {
    return null;
  }

  const countResult = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM promptoon_user_like WHERE publish_id = $1',
    [publishId]
  );
  const likeCount = Number(countResult.rows[0]?.count ?? 0);

  await db.query(
    `UPDATE promptoon_feed_item
     SET metrics_json = jsonb_set(
           COALESCE(metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
           '{likes}',
           to_jsonb($2::integer),
           true
         ),
         payload_json = jsonb_set(
           jsonb_set(
             payload_json,
             '{metrics}',
             COALESCE(payload_json->'metrics', metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
             true
           ),
           '{metrics,likes}',
           to_jsonb($2::integer),
           true
         ),
         updated_at = NOW()
     WHERE publish_id = $1`,
    [publishId, likeCount]
  );

  return context;
}

export async function refreshMovingtoonFeedItemLikeMetrics(
  db: DbExecutor,
  publishId: string
): Promise<MovingtoonPublishProjectionContextRow | null> {
  const context = await getMovingtoonPublishProjectionContext(db, publishId);
  if (!context) {
    return null;
  }

  const countResult = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM promptoon_user_movingtoon_like WHERE movingtoon_publish_id = $1',
    [publishId]
  );
  const likeCount = Number(countResult.rows[0]?.count ?? 0);

  await db.query(
    `UPDATE promptoon_feed_item
     SET metrics_json = jsonb_set(
           COALESCE(metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
           '{likes}',
           to_jsonb($2::integer),
           true
         ),
         payload_json = jsonb_set(
           jsonb_set(
             payload_json,
             '{metrics}',
             COALESCE(payload_json->'metrics', metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
             true
           ),
           '{metrics,likes}',
           to_jsonb($2::integer),
           true
         ),
         updated_at = NOW()
     WHERE movingtoon_publish_id = $1`,
    [publishId, likeCount]
  );

  return context;
}

export async function getChannelBySlug(db: DbExecutor, slug: string): Promise<ProductChannelRow | null> {
  const result = await db.query<ProductChannelRow>('SELECT * FROM promptoon_channel WHERE slug = $1 AND visibility = $2', [slug, 'public']);
  return result.rows[0] ?? null;
}

export async function getChannelHomeProjection(db: DbExecutor, channelId: string): Promise<ChannelHome | null> {
  const result = await db.query<ChannelHomeProjectionRow>(
    `SELECT profile_json, featured_series_json, latest_episodes_json, latest_shorts_json, community_meta_json
     FROM promptoon_channel_home_projection
     WHERE channel_id = $1`,
    [channelId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    profile: row.profile_json,
    featuredSeries: row.featured_series_json,
    latestEpisodes: row.latest_episodes_json,
    latestShorts: row.latest_shorts_json,
    communityMeta: row.community_meta_json ?? undefined
  };
}

export async function buildChannelHomeFromPublicTables(db: DbExecutor, channelId: string): Promise<ChannelHome | null> {
  const channelResult = await db.query<ProductChannelRow & { owner_login_id: string | null }>(
    `SELECT channel.*, users.login_id AS owner_login_id
     FROM promptoon_channel AS channel
     LEFT JOIN users ON users.id = channel.owner_user_id
     WHERE channel.id = $1`,
    [channelId]
  );
  const channel = channelResult.rows[0];
  if (!channel) {
    return null;
  }

  const counts = await db.query<{
    subscriber_count: string;
    like_count: string;
    series_count: string;
    episode_count: string;
    short_count: string;
    comment_count: string;
    latest_comment_at: Date | null;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM promptoon_user_subscription WHERE channel_id = $1)::text AS subscriber_count,
       (SELECT COUNT(*) FROM promptoon_user_like AS likes
          JOIN promptoon_publish AS publish ON publish.id = likes.publish_id
         WHERE publish.channel_id = $1)::text AS like_count,
       (SELECT COUNT(*) FROM promptoon_series WHERE channel_id = $1)::text AS series_count,
       (SELECT COUNT(*) FROM promptoon_feed_item WHERE channel_id = $1)::text AS episode_count,
       (SELECT COUNT(*) FROM promptoon_short_clip WHERE channel_id = $1 AND status = 'published')::text AS short_count,
       (SELECT COALESCE(SUM(discussion.comment_count), 0)
          FROM promptoon_episode_discussion AS discussion
          JOIN promptoon_publish AS publish ON publish.id = discussion.publish_id
         WHERE publish.channel_id = $1)::text AS comment_count,
       (SELECT MAX(discussion.latest_comment_at)
          FROM promptoon_episode_discussion AS discussion
          JOIN promptoon_publish AS publish ON publish.id = discussion.publish_id
         WHERE publish.channel_id = $1) AS latest_comment_at`,
    [channelId]
  );
  const countRow = counts.rows[0];

  const seriesResult = await db.query<ProductSeriesRow>(
    `SELECT *
     FROM promptoon_series
     WHERE channel_id = $1
     ORDER BY sort_order, created_at
     LIMIT 8`,
    [channelId]
  );
  const episodesResult = await db.query<{
    episode_id: string;
    publish_id: string;
    title: string;
    episode_no: number;
    thumbnail_url: string | null;
    published_at: Date;
  }>(
    `SELECT
       item.episode_id,
       item.publish_id,
       item.title,
       episode.episode_no,
       item.cover_image_url AS thumbnail_url,
       item.published_at
     FROM promptoon_feed_item AS item
     JOIN promptoon_episode AS episode ON episode.id = item.episode_id
     WHERE item.channel_id = $1
     ORDER BY item.published_at DESC, item.id DESC
     LIMIT 12`,
    [channelId]
  );
  const shortsResult = await db.query<{
    id: string;
    title: string;
    thumbnail_url: string | null;
    video_url: string | null;
    duration_sec: number;
    publish_id: string | null;
    movingtoon_publish_id: string | null;
  }>(
    `SELECT id, title, thumbnail_url, video_url, duration_sec, publish_id, movingtoon_publish_id
     FROM promptoon_short_clip
     WHERE channel_id = $1 AND status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT 8`,
    [channelId]
  );

  const profile = mapChannelProfile(channel, {
    ownerLoginId: channel.owner_login_id,
    subscriberCount: Number(countRow?.subscriber_count ?? 0),
    likeCount: Number(countRow?.like_count ?? 0),
    seriesCount: Number(countRow?.series_count ?? 0),
    episodeCount: Number(countRow?.episode_count ?? 0),
    shortCount: Number(countRow?.short_count ?? 0)
  });

  return {
    profile,
    featuredSeries: seriesResult.rows.map((series) => ({
      id: series.id,
      title: series.title,
      slug: series.slug,
      description: series.description,
      coverImageUrl: series.cover_image_url,
      episodeCount: Number(countRow?.episode_count ?? 0),
      status: series.status
    })),
    latestEpisodes: episodesResult.rows.map((episode) => ({
      id: episode.episode_id,
      publishId: episode.publish_id,
      title: episode.title,
      episodeNo: episode.episode_no,
      thumbnailUrl: episode.thumbnail_url,
      publishedAt: toIsoString(episode.published_at)
    })),
    latestShorts: shortsResult.rows.map((short) => ({
      id: short.id,
      title: short.title,
      thumbnailUrl: short.thumbnail_url,
      videoUrl: short.video_url,
      durationSec: short.duration_sec,
      publishId: short.movingtoon_publish_id ?? short.publish_id
    })),
    communityMeta: {
      commentCount: Number(countRow?.comment_count ?? 0),
      latestCommentAt: countRow?.latest_comment_at ? toIsoString(countRow.latest_comment_at) : null
    }
  };
}

export async function upsertChannelHomeProjection(db: DbExecutor, channelId: string, home: ChannelHome): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_channel_home_projection (
       channel_id,
       profile_json,
       featured_series_json,
       latest_episodes_json,
       latest_shorts_json,
       community_meta_json
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (channel_id) DO UPDATE
       SET profile_json = EXCLUDED.profile_json,
           featured_series_json = EXCLUDED.featured_series_json,
           latest_episodes_json = EXCLUDED.latest_episodes_json,
           latest_shorts_json = EXCLUDED.latest_shorts_json,
           community_meta_json = EXCLUDED.community_meta_json,
           updated_at = NOW()`,
    [
      channelId,
      JSON.stringify(home.profile),
      JSON.stringify(home.featuredSeries),
      JSON.stringify(home.latestEpisodes),
      JSON.stringify(home.latestShorts),
      JSON.stringify(home.communityMeta ?? null)
    ]
  );
}

export async function ensureEpisodeDiscussion(
  db: DbExecutor,
  input: {
    episodeId: string;
    publishId?: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_episode_discussion (episode_id, publish_id, discussion_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (episode_id) DO UPDATE
       SET publish_id = COALESCE(EXCLUDED.publish_id, promptoon_episode_discussion.publish_id),
           updated_at = NOW()`,
    [input.episodeId, input.publishId ?? null, input.publishId ? `/community/publishes/${input.publishId}` : null]
  );
}

export async function getCommentsMetaByPublishId(db: DbExecutor, publishId: string): Promise<ProductCommentsMetaRow | null> {
  const result = await db.query<ProductCommentsMetaRow>(
    `SELECT publish_id, comment_count, latest_comment_at, discussion_url
     FROM promptoon_episode_discussion
     WHERE publish_id = $1
     UNION ALL
     SELECT
       movingtoon.id AS publish_id,
       COUNT(comment.id)::integer AS comment_count,
       MAX(comment.created_at) AS latest_comment_at,
       '/community/publishes/' || movingtoon.id::text AS discussion_url
     FROM promptoon_movingtoon_publish AS movingtoon
     LEFT JOIN promptoon_comment AS comment
       ON comment.movingtoon_publish_id = movingtoon.id
      AND comment.status = 'visible'
     WHERE movingtoon.id = $1
     GROUP BY movingtoon.id
     LIMIT 1`,
    [publishId]
  );

  return result.rows[0] ?? null;
}

export async function listCommunityComments(db: DbExecutor, publishId: string): Promise<CommunityComment[]> {
  const result = await db.query<CommunityCommentRow>(
    `SELECT id, publish_id, movingtoon_publish_id, discussion_id, user_id, body, status, moderation_reason, created_at, updated_at
     FROM promptoon_comment
     WHERE (publish_id = $1 OR movingtoon_publish_id = $1)
       AND status = 'visible'
     ORDER BY created_at ASC, id ASC`,
    [publishId]
  );

  return result.rows.map(mapCommunityComment);
}

export async function getCommunityCommentById(db: DbExecutor, commentId: string): Promise<CommunityComment | null> {
  const result = await db.query<CommunityCommentRow>(
    `SELECT id, publish_id, movingtoon_publish_id, discussion_id, user_id, body, status, moderation_reason, created_at, updated_at
     FROM promptoon_comment
     WHERE id = $1`,
    [commentId]
  );

  return result.rows[0] ? mapCommunityComment(result.rows[0]) : null;
}

export async function createCommunityComment(
  db: DbExecutor,
  input: {
    publishId: string;
    userId: string | null;
    body: string;
  }
): Promise<CommunityComment> {
  const result = await db.query<CommunityCommentRow>(
    `WITH target AS (
       SELECT
         $1::uuid AS id,
         EXISTS (SELECT 1 FROM promptoon_publish WHERE id = $1) AS is_promptoon,
         EXISTS (SELECT 1 FROM promptoon_movingtoon_publish WHERE id = $1) AS is_movingtoon
     )
     INSERT INTO promptoon_comment (publish_id, movingtoon_publish_id, discussion_id, user_id, body)
     SELECT
       CASE WHEN is_promptoon THEN id ELSE NULL END,
       CASE WHEN is_movingtoon THEN id ELSE NULL END,
       CASE WHEN is_promptoon THEN (SELECT id FROM promptoon_episode_discussion WHERE publish_id = target.id LIMIT 1) ELSE NULL END,
       $2,
       $3
     FROM target
     WHERE is_promptoon OR is_movingtoon
     RETURNING id, publish_id, movingtoon_publish_id, discussion_id, user_id, body, status, moderation_reason, created_at, updated_at`,
    [input.publishId, input.userId, input.body]
  );

  return mapCommunityComment(result.rows[0]);
}

export async function updateCommunityCommentBody(
  db: DbExecutor,
  input: {
    commentId: string;
    body: string;
  }
): Promise<CommunityComment | null> {
  const result = await db.query<CommunityCommentRow>(
    `UPDATE promptoon_comment
     SET body = $2,
         updated_at = NOW()
     WHERE id = $1
       AND status <> 'deleted'
     RETURNING id, publish_id, movingtoon_publish_id, discussion_id, user_id, body, status, moderation_reason, created_at, updated_at`,
    [input.commentId, input.body]
  );

  return result.rows[0] ? mapCommunityComment(result.rows[0]) : null;
}

export async function moderateCommunityComment(
  db: DbExecutor,
  input: {
    commentId: string;
    status: CommunityCommentStatus;
    reason?: string | null;
  }
): Promise<CommunityComment | null> {
  const result = await db.query<CommunityCommentRow>(
    `UPDATE promptoon_comment
     SET status = $2,
         moderation_reason = $3,
         body = CASE WHEN $2 = 'deleted' THEN '' ELSE body END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, publish_id, movingtoon_publish_id, discussion_id, user_id, body, status, moderation_reason, created_at, updated_at`,
    [input.commentId, input.status, input.reason ?? null]
  );

  return result.rows[0] ? mapCommunityComment(result.rows[0]) : null;
}

export async function refreshCommunityCommentMetrics(
  db: DbExecutor,
  publishId: string
): Promise<ProductPublishProjectionContextRow | MovingtoonPublishProjectionContextRow | null> {
  const context = (await getPublishProjectionContext(db, publishId)) ?? (await getMovingtoonPublishProjectionContext(db, publishId));

  const countResult = await db.query<{ comment_count: string; latest_comment_at: Date | null }>(
    `SELECT COUNT(*)::text AS comment_count,
            MAX(created_at) AS latest_comment_at
     FROM promptoon_comment
     WHERE (publish_id = $1 OR movingtoon_publish_id = $1)
       AND status = 'visible'`,
    [publishId]
  );
  const countRow = countResult.rows[0];
  const commentCount = Number(countRow?.comment_count ?? 0);

  await db.query(
    `UPDATE promptoon_episode_discussion
     SET comment_count = $2,
         latest_comment_at = $3,
         updated_at = NOW()
     WHERE publish_id = $1`,
    [publishId, commentCount, countRow?.latest_comment_at ?? null]
  );

  await db.query(
    `UPDATE promptoon_feed_item
     SET metrics_json = jsonb_set(
           COALESCE(metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
           '{comments}',
           to_jsonb($2::integer),
           true
         ),
         payload_json = jsonb_set(
           jsonb_set(
             payload_json,
             '{metrics}',
             COALESCE(payload_json->'metrics', metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
             true
           ),
           '{metrics,comments}',
           to_jsonb($2::integer),
           true
         ),
         updated_at = NOW()
     WHERE publish_id = $1 OR movingtoon_publish_id = $1`,
    [publishId, commentCount]
  );

  return context;
}

export async function getDiscourseThreadSync(db: DbExecutor, publishId: string): Promise<DiscourseThreadSyncResponse | null> {
  const result = await db.query<DiscourseThreadSyncRow>(
    `SELECT publish_id, discourse_topic_id, provider_status, payload_json, last_synced_at
     FROM promptoon_discourse_thread_sync
     WHERE publish_id = $1`,
    [publishId]
  );

  return result.rows[0] ? mapDiscourseThreadSync(result.rows[0]) : null;
}

export async function upsertDiscourseThreadSync(
  db: DbExecutor,
  input: {
    publishId: string;
    discourseTopicId?: string | null;
    status: CommunityThreadSyncStatus;
    payload?: Record<string, unknown>;
  }
): Promise<DiscourseThreadSyncResponse> {
  const result = await db.query<DiscourseThreadSyncRow>(
    `INSERT INTO promptoon_discourse_thread_sync (publish_id, discourse_topic_id, provider_status, payload_json, last_synced_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'synced' THEN NOW() ELSE NULL END)
     ON CONFLICT (publish_id) DO UPDATE
       SET discourse_topic_id = EXCLUDED.discourse_topic_id,
           provider_status = EXCLUDED.provider_status,
           payload_json = EXCLUDED.payload_json,
           last_synced_at = CASE WHEN EXCLUDED.provider_status = 'synced' THEN NOW() ELSE promptoon_discourse_thread_sync.last_synced_at END,
           updated_at = NOW()
     RETURNING publish_id, discourse_topic_id, provider_status, payload_json, last_synced_at`,
    [input.publishId, input.discourseTopicId ?? null, input.status, JSON.stringify(input.payload ?? {})]
  );

  if (input.discourseTopicId) {
    await db.query(
      `UPDATE promptoon_episode_discussion
       SET discourse_topic_id = $2,
           updated_at = NOW()
       WHERE publish_id = $1`,
      [input.publishId, input.discourseTopicId]
    );
  }

  return mapDiscourseThreadSync(result.rows[0]);
}

export async function getProjectDiscussion(db: DbExecutor, projectId: string): Promise<ProductProjectDiscussion | null> {
  const result = await db.query<ProjectDiscussionRow>(
    `SELECT project_id, discourse_topic_id, provider_status, discussion_url, comment_count, latest_comment_at, payload_json, last_synced_at
     FROM promptoon_project_discussion
     WHERE project_id = $1`,
    [projectId]
  );

  return result.rows[0] ? mapProjectDiscussion(result.rows[0]) : null;
}

export async function upsertProjectDiscussionSync(
  db: DbExecutor,
  input: {
    projectId: string;
    discourseTopicId?: string | null;
    status: CommunityThreadSyncStatus;
    discussionUrl?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<ProductProjectDiscussion> {
  const result = await db.query<ProjectDiscussionRow>(
    `INSERT INTO promptoon_project_discussion
       (project_id, discourse_topic_id, provider_status, discussion_url, payload_json, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $3 = 'synced' THEN NOW() ELSE NULL END)
     ON CONFLICT (project_id) DO UPDATE
       SET discourse_topic_id = EXCLUDED.discourse_topic_id,
           provider_status = EXCLUDED.provider_status,
           discussion_url = EXCLUDED.discussion_url,
           payload_json = EXCLUDED.payload_json,
           last_synced_at = CASE WHEN EXCLUDED.provider_status = 'synced' THEN NOW() ELSE promptoon_project_discussion.last_synced_at END,
           updated_at = NOW()
     RETURNING project_id, discourse_topic_id, provider_status, discussion_url, comment_count, latest_comment_at, payload_json, last_synced_at`,
    [
      input.projectId,
      input.discourseTopicId ?? null,
      input.status,
      input.discussionUrl ?? null,
      JSON.stringify(input.payload ?? {})
    ]
  );

  return mapProjectDiscussion(result.rows[0]);
}

export async function updateProjectDiscussionMetrics(
  db: DbExecutor,
  input: {
    projectId: string;
    commentCount: number;
    latestCommentAt?: string | null;
  }
): Promise<void> {
  await db.query(
    `UPDATE promptoon_project_discussion
     SET comment_count = $2,
         latest_comment_at = $3,
         updated_at = NOW()
     WHERE project_id = $1`,
    [input.projectId, input.commentCount, input.latestCommentAt ?? null]
  );
}

export async function updateEpisodeDiscourseMetrics(
  db: DbExecutor,
  input: {
    publishId: string;
    discourseTopicId: string;
    commentCount: number;
    latestCommentAt?: string | null;
    discussionUrl?: string | null;
  }
): Promise<ProductPublishProjectionContextRow | null> {
  const context = await getPublishProjectionContext(db, input.publishId);
  if (!context) {
    return null;
  }

  await ensureEpisodeDiscussion(db, {
    episodeId: context.episode_id,
    publishId: input.publishId
  });

  await db.query(
    `UPDATE promptoon_episode_discussion
     SET discourse_topic_id = $2,
         discussion_url = COALESCE($5, discussion_url),
         comment_count = $3,
         latest_comment_at = $4,
         updated_at = NOW()
     WHERE publish_id = $1`,
    [input.publishId, input.discourseTopicId, input.commentCount, input.latestCommentAt ?? null, input.discussionUrl ?? null]
  );

  await db.query(
    `UPDATE promptoon_feed_item
     SET metrics_json = jsonb_set(
           COALESCE(metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
           '{comments}',
           to_jsonb($2::integer),
           true
         ),
         payload_json = jsonb_set(
           jsonb_set(
             payload_json,
             '{metrics}',
             COALESCE(payload_json->'metrics', metrics_json, '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb),
             true
           ),
           '{metrics,comments}',
           to_jsonb($2::integer),
           true
         ),
         updated_at = NOW()
     WHERE publish_id = $1`,
    [input.publishId, input.commentCount]
  );

  return context;
}

export async function listSyncedDiscourseTopicContextsByProjectId(
  db: DbExecutor,
  projectId: string
): Promise<ProductDiscourseTopicContext[]> {
  const result = await db.query<DiscourseTopicContextRow>(
    `SELECT *
     FROM (
       SELECT
         discussion.project_id,
         NULL::uuid AS publish_id,
         NULL::uuid AS episode_id,
         NULL::text AS episode_title,
         discussion.discourse_topic_id,
         'project'::text AS source
       FROM promptoon_project_discussion AS discussion
       WHERE discussion.project_id = $1
         AND discussion.provider_status = 'synced'
         AND discussion.discourse_topic_id IS NOT NULL

       UNION ALL

       SELECT
         publish.project_id,
         publish.id AS publish_id,
         publish.episode_id,
         COALESCE(publish.manifest #>> '{episode,title}', episode.title) AS episode_title,
         sync.discourse_topic_id,
         'episode'::text AS source
       FROM promptoon_publish AS publish
       JOIN promptoon_episode AS episode ON episode.id = publish.episode_id
       JOIN promptoon_discourse_thread_sync AS sync ON sync.publish_id = publish.id
       WHERE publish.project_id = $1
         AND publish.status = 'published'
         AND sync.provider_status = 'synced'
         AND sync.discourse_topic_id IS NOT NULL
     ) AS contexts
     ORDER BY CASE WHEN source = 'project' THEN 0 ELSE 1 END, episode_title ASC NULLS FIRST, publish_id ASC NULLS FIRST`,
    [projectId]
  );

  return result.rows.map(mapDiscourseTopicContext);
}

export async function getDiscourseTopicContextForProject(
  db: DbExecutor,
  input: {
    projectId: string;
    topicId: string;
  }
): Promise<ProductDiscourseTopicContext | null> {
  const contexts = await listSyncedDiscourseTopicContextsByProjectId(db, input.projectId);
  return contexts.find((context) => context.discourseTopicId === input.topicId) ?? null;
}

export async function getUserCommunityIdentity(db: DbExecutor, userId: string): Promise<ProductUserCommunityIdentity | null> {
  const result = await db.query<{
    id: string;
    login_id: string;
    email: string | null;
    display_name: string | null;
    profile_image_url: string | null;
    discourse_username: string | null;
  }>(
    `SELECT id, login_id, email, display_name, profile_image_url, discourse_username
     FROM users
     WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    loginId: row.login_id,
    email: row.email,
    displayName: row.display_name,
    profileImageUrl: row.profile_image_url,
    discourseUsername: row.discourse_username
  };
}

export async function updateUserDiscourseUsername(
  db: DbExecutor,
  input: {
    userId: string;
    discourseUsername: string;
  }
): Promise<void> {
  await db.query(
    `UPDATE users
     SET discourse_username = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [input.userId, input.discourseUsername]
  );
}

export async function listRelatedShortsForPublish(db: DbExecutor, publishId: string, limit = 8): Promise<RelatedShort[]> {
  const result = await db.query<RelatedShortRow>(
    `WITH target_publish AS (
       SELECT id, channel_id, series_id
       FROM promptoon_publish
       WHERE id = $1
     )
     SELECT
       short.id,
       short.title,
       short.thumbnail_url,
       short.duration_sec,
       short.publish_id,
       short.movingtoon_publish_id,
       channel.slug AS channel_slug
     FROM promptoon_short_clip AS short
     JOIN target_publish AS target ON
       short.publish_id = target.id
       OR (short.channel_id IS NOT NULL AND short.channel_id = target.channel_id)
       OR (short.series_id IS NOT NULL AND short.series_id = target.series_id)
     LEFT JOIN promptoon_channel AS channel ON channel.id = short.channel_id
     WHERE short.status = 'published'
     ORDER BY
       CASE WHEN short.publish_id = $1 THEN 0 ELSE 1 END,
       short.published_at DESC NULLS LAST,
       short.created_at DESC,
       short.id DESC
     LIMIT $2`,
    [publishId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    durationSec: row.duration_sec,
    href: row.movingtoon_publish_id
      ? `/shorts/${row.movingtoon_publish_id}`
      : row.publish_id
        ? `/v/${row.publish_id}`
        : row.channel_slug
          ? `/c/${row.channel_slug}/shorts`
          : '/feed'
  }));
}

export async function upsertUserSubscription(db: DbExecutor, channelId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_user_subscription (user_id, channel_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, channel_id) DO NOTHING`,
    [userId, channelId]
  );
}

export async function deleteUserSubscription(db: DbExecutor, channelId: string, userId: string): Promise<void> {
  await db.query('DELETE FROM promptoon_user_subscription WHERE user_id = $1 AND channel_id = $2', [userId, channelId]);
}

export async function insertTelemetryEvent(db: DbExecutor, payload: TelemetryEventPayload): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_telemetry_event (
       event_name,
       anonymous_id,
       user_id,
       session_id,
       project_id,
       channel_id,
       series_id,
       episode_id,
       publish_id,
       feed_item_id,
       payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      payload.eventName,
      payload.anonymousId ?? null,
      payload.userId ?? null,
      payload.sessionId ?? null,
      payload.projectId ?? null,
      payload.channelId ?? null,
      payload.seriesId ?? null,
      payload.episodeId ?? null,
      payload.publishId ?? null,
      payload.feedItemId ?? null,
      JSON.stringify(payload.payload ?? {})
    ]
  );
}

export async function createViewerEvent(
  db: DbExecutor,
  input: {
    publishId: string;
    episodeId: string;
    anonymousId: string;
    sessionId: string;
    eventType: TelemetryEventType;
    cutId: string;
    choiceId?: string;
    durationMs?: number;
    surface?: string;
    position?: number;
    trackingToken?: string;
    recommendationRequestId?: string;
    policyId?: string;
    modelVersion?: string;
    experimentId?: string;
  }
): Promise<void> {
  await db.query<ViewerEventInsertRow>(
    `INSERT INTO promptoon_viewer_event (
       id,
       publish_id,
       episode_id,
       anonymous_id,
       session_id,
       event_type,
       cut_id,
       choice_id,
       duration_ms,
       surface,
       position,
       tracking_token,
       recommendation_request_id,
       policy_id,
       model_version,
       experiment_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      randomUUID(),
      input.publishId,
      input.episodeId,
      input.anonymousId,
      input.sessionId,
      input.eventType,
      input.cutId,
      input.choiceId ?? null,
      input.durationMs ?? null,
      input.surface ?? null,
      input.position ?? null,
      input.trackingToken ?? null,
      input.recommendationRequestId ?? null,
      input.policyId ?? null,
      input.modelVersion ?? null,
      input.experimentId ?? null
    ]
  );
}

export async function updatePublishPublicPlacement(
  db: DbExecutor,
  input: {
    publishId: string;
    channelId: string;
    seriesId: string;
  }
): Promise<void> {
  await db.query(
    `UPDATE promptoon_publish
     SET channel_id = $2,
         series_id = $3
     WHERE id = $1`,
    [input.publishId, input.channelId, input.seriesId]
  );
}
