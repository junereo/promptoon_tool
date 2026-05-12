import type {
  AnalyticsChoiceStat,
  AnalyticsCutEngagement,
  AnalyticsEndingStat,
  AnalyticsResetScope,
  AnalyticsViewGranularity,
  AnalyticsViewPoint,
  ChannelHome,
  ChannelProfile,
  ChannelSubscriptionStateResponse,
  Choice,
  ChoiceStateWrite,
  ContentInteractionState,
  Cut,
  CutContentBlock,
  CutStateRoute,
  CutStateVariant,
  Episode,
  EpisodeDraftResponse,
  ExitLoopEpisodeMetadata,
  FeedItemMetrics,
  PromptoonEpisodeMode,
  ProjectAssetListResponse,
  ProjectAssetSummary,
  ProjectPublishHistoryItem,
  ProjectPublishHistoryResponse,
  Project,
  ProjectWithEpisodes,
  Publish,
  PublishManifest,
  PatchEpisodeCutLayoutRequest,
  ProjectMemberSummary,
  ProjectRole,
  PromptoonBackupChoice,
  PromptoonBackupProject,
  PromptoonBackupViewerEvent,
  ReorderEpisodeCutsRequest,
  TelemetryEventPayload,
  TelemetryEventType,
  ViewerInteractionStateResponse
} from '@promptoon/shared';
import {
  DEFAULT_CONTENT_SPACING,
  DEFAULT_CUT_EFFECT_DURATION_MS,
  DEFAULT_EDGE_FADE,
  DEFAULT_EDGE_FADE_COLOR,
  DEFAULT_EDGE_FADE_INTENSITY
} from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import type { DbExecutor } from '../../db';
import { buildFeedItemAccessPredicate, buildFeedItemExperimentalPredicate } from '../experimental/experimental.repository';

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: 'draft' | 'published';
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface ProjectWithEpisodesRow extends ProjectRow {
  episodes: Episode[];
}

interface ProjectAssetRow {
  asset_url: string;
  source: ProjectAssetSummary['source'];
  episode_id: string | null;
  episode_title: string | null;
  cut_id: string | null;
  cut_title: string | null;
  updated_at: Date;
}

interface EpisodeRow {
  id: string;
  project_id: string;
  title: string;
  episode_no: number;
  cover_image_url: string | null;
  start_cut_id: string | null;
  mode: PromptoonEpisodeMode;
  exit_loop_metadata: ExitLoopEpisodeMetadata | null;
  status: 'draft' | 'published';
  created_at: Date;
  updated_at: Date;
}

interface CutRow {
  id: string;
  episode_id: string;
  kind: Cut['kind'];
  title: string;
  body: string;
  content_blocks: CutContentBlock[] | null;
  content_view_mode: Cut['contentViewMode'] | null;
  state_variants: CutStateVariant[] | null;
  state_routes: CutStateRoute[] | null;
  state_fallback_cut_id: string | null;
  loop_metadata: Cut['loopMetadata'] | null;
  dialog_anchor_x: Cut['dialogAnchorX'];
  dialog_anchor_y: Cut['dialogAnchorY'];
  dialog_offset_x: number;
  dialog_offset_y: number;
  dialog_text_align: 'left' | 'center' | 'right';
  start_effect: Cut['startEffect'];
  end_effect: Cut['endEffect'];
  start_effect_duration_ms: number | null;
  end_effect_duration_ms: number | null;
  asset_url: string | null;
  edge_fade: Cut['edgeFade'] | null;
  edge_fade_intensity: Cut['edgeFadeIntensity'] | null;
  edge_fade_color: Cut['edgeFadeColor'] | null;
  margin_bottom_token: Cut['marginBottomToken'] | null;
  position_x: number;
  position_y: number;
  order_index: number;
  is_start: boolean;
  is_ending: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ChoiceRow {
  id: string;
  cut_id: string;
  label: string;
  order_index: number;
  next_cut_id: string | null;
  after_select_reaction_text: string | null;
  after_select_delay_ms: number | null;
  state_writes: ChoiceStateWrite[] | null;
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

interface ProjectPublishHistoryRow {
  publish_id: string;
  episode_id: string;
  episode_title: string;
  episode_no: number;
  version_no: number;
  status: Publish['status'];
  created_at: Date;
  channel_id: string | null;
  series_id: string | null;
}

interface ViewerEventInsertRow {
  id: string;
}

interface ViewerEventRow {
  id: string;
  publish_id: string;
  episode_id: string;
  anonymous_id: string;
  session_id: string | null;
  event_type: TelemetryEventType;
  cut_id: string;
  choice_id: string | null;
  duration_ms: number | null;
  created_at: Date;
}

interface ViewerEventCountRow {
  count: string;
}

interface ChoiceBackupRow extends ChoiceRow {
  episode_id: string;
}

interface ViewsByPeriodRow {
  period_start: string;
  views: string;
  unique_viewers: string;
}

interface ChoiceStatRow {
  cut_id: string;
  choice_id: string;
  label: string;
  count: string;
  avg_hesitation_ms: string | null;
}

interface CutEngagementRow {
  cut_id: string;
  drop_off_count: string | null;
  avg_duration_ms: string | null;
}

interface EndingStatRow {
  cut_id: string;
  count: string;
}

interface FeedCursorInput {
  createdAt: string;
  publishId: string;
}

interface ChannelRow {
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

interface SeriesRow {
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

interface FeedItemProjectionRow {
  id: string;
  publish_id: string;
  project_id: string;
  channel_id: string | null;
  series_id: string | null;
  episode_id: string;
  metrics_json: import('@promptoon/shared').FeedItemMetrics | null;
  payload_json: import('@promptoon/shared').FeedItem;
  published_at: Date;
  is_experimental: boolean | null;
}

interface ContentInteractionStateRow {
  publish_id: string;
  liked: boolean;
  bookmarked: boolean;
  metrics_json: import('@promptoon/shared').FeedItemMetrics | null;
}

interface ViewerInteractionStateRow extends ContentInteractionStateRow {
  channel_id: string | null;
  subscribed_to_channel: boolean;
}

interface PublishProjectionContextRow {
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

interface CommentsMetaRow {
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
  channel_slug: string | null;
}

interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  login_id: string;
  role: ProjectRole;
  created_at: Date;
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
    status: row.status,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    episodeNo: row.episode_no,
    coverImageUrl: row.cover_image_url,
    startCutId: row.start_cut_id,
    mode: row.mode,
    exitLoopMetadata: row.exit_loop_metadata,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapCut(row: CutRow): Cut {
  return {
    id: row.id,
    episodeId: row.episode_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    contentBlocks: row.content_blocks ?? [],
    contentViewMode: row.content_view_mode ?? 'default',
    dialogAnchorX: row.dialog_anchor_x,
    dialogAnchorY: row.dialog_anchor_y,
    dialogOffsetX: row.dialog_offset_x,
    dialogOffsetY: row.dialog_offset_y,
    dialogTextAlign: row.dialog_text_align,
    startEffect: row.start_effect ?? 'none',
    endEffect: row.end_effect ?? 'none',
    startEffectDurationMs: row.start_effect_duration_ms ?? DEFAULT_CUT_EFFECT_DURATION_MS,
    endEffectDurationMs: row.end_effect_duration_ms ?? DEFAULT_CUT_EFFECT_DURATION_MS,
    assetUrl: row.asset_url,
    edgeFade: row.edge_fade ?? DEFAULT_EDGE_FADE,
    edgeFadeIntensity: row.edge_fade_intensity ?? DEFAULT_EDGE_FADE_INTENSITY,
    edgeFadeColor: row.edge_fade_color ?? DEFAULT_EDGE_FADE_COLOR,
    marginBottomToken: row.margin_bottom_token ?? DEFAULT_CONTENT_SPACING,
    stateVariants: Array.isArray(row.state_variants) ? row.state_variants : [],
    stateRoutes: Array.isArray(row.state_routes) ? row.state_routes : [],
    stateFallbackCutId: row.state_fallback_cut_id,
    loopMetadata: row.loop_metadata ?? null,
    positionX: row.position_x,
    positionY: row.position_y,
    orderIndex: row.order_index,
    isStart: row.is_start,
    isEnding: row.is_ending,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapChoice(row: ChoiceRow): Choice {
  return {
    id: row.id,
    cutId: row.cut_id,
    label: row.label,
    orderIndex: row.order_index,
    nextCutId: row.next_cut_id,
    afterSelectReactionText: row.after_select_reaction_text ?? undefined,
    stateWrites: Array.isArray(row.state_writes) ? row.state_writes : [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapBackupChoice(row: ChoiceRow): PromptoonBackupChoice {
  return {
    ...mapChoice(row),
    afterSelectDelayMs: row.after_select_delay_ms
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

function mapChannelProfile(row: ChannelRow, counts?: Partial<ChannelProfile>): ChannelProfile {
  return {
    id: row.id,
    slug: row.slug,
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

function mapProjectMember(row: ProjectMemberRow): ProjectMemberSummary {
  return {
    projectId: row.project_id,
    userId: row.user_id,
    loginId: row.login_id,
    role: row.role,
    createdAt: toIsoString(row.created_at)
  };
}

function mapViewerEvent(row: ViewerEventRow): PromptoonBackupViewerEvent {
  return {
    id: row.id,
    publishId: row.publish_id,
    episodeId: row.episode_id,
    anonymousId: row.anonymous_id,
    sessionId: row.session_id,
    eventType: row.event_type,
    cutId: row.cut_id,
    choiceId: row.choice_id ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    createdAt: toIsoString(row.created_at)
  };
}

export async function listProjects(db: DbExecutor): Promise<Project[]> {
  const result = await db.query<ProjectRow>('SELECT * FROM promptoon_project ORDER BY updated_at DESC');
  return result.rows.map(mapProject);
}

export async function listProjectsWithEpisodes(db: DbExecutor, userId?: string): Promise<ProjectWithEpisodes[]> {
  const values: unknown[] = [];
  const accessFilter = userId
    ? (() => {
        values.push(userId);
        return `WHERE project.created_by = $${values.length}
           OR EXISTS (
             SELECT 1
             FROM promptoon_project_member AS member
             WHERE member.project_id = project.id
               AND member.user_id = $${values.length}
           )`;
      })()
    : '';
  const result = await db.query<ProjectWithEpisodesRow>(
    `SELECT
       project.id,
       project.title,
       project.description,
       project.thumbnail_url,
       project.status,
       project.created_by,
       project.created_at,
       project.updated_at,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'id', episode.id,
             'projectId', episode.project_id,
             'title', episode.title,
             'episodeNo', episode.episode_no,
             'coverImageUrl', episode.cover_image_url,
             'startCutId', episode.start_cut_id,
             'mode', episode.mode,
             'exitLoopMetadata', episode.exit_loop_metadata,
             'status', episode.status,
             'createdAt', episode.created_at,
             'updatedAt', episode.updated_at
           )
           ORDER BY episode.episode_no ASC
         ) FILTER (WHERE episode.id IS NOT NULL),
         '[]'::jsonb
       ) AS episodes
     FROM promptoon_project AS project
     LEFT JOIN promptoon_episode AS episode
       ON episode.project_id = project.id
     ${accessFilter}
     GROUP BY project.id
     ORDER BY project.updated_at DESC`
    ,
    values
  );

  return result.rows.map((row) => ({
    ...mapProject(row),
    episodes: row.episodes
  }));
}

function groupByKey<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  return grouped;
}

export async function getUserBackupProjects(db: DbExecutor, ownerId: string): Promise<PromptoonBackupProject[]> {
  const [projectsResult, episodesResult, cutsResult, choicesResult, publishesResult, viewerEventsResult] = await Promise.all([
    db.query<ProjectRow>('SELECT * FROM promptoon_project WHERE created_by = $1 ORDER BY updated_at DESC, created_at DESC', [ownerId]),
    db.query<EpisodeRow>(
      `SELECT episode.*
       FROM promptoon_episode AS episode
       INNER JOIN promptoon_project AS project ON project.id = episode.project_id
       WHERE project.created_by = $1
       ORDER BY episode.project_id ASC, episode.episode_no ASC, episode.created_at ASC`,
      [ownerId]
    ),
    db.query<CutRow>(
      `SELECT cut.*
       FROM promptoon_cut AS cut
       INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
       INNER JOIN promptoon_project AS project ON project.id = episode.project_id
       WHERE project.created_by = $1
       ORDER BY cut.episode_id ASC, cut.order_index ASC, cut.created_at ASC`,
      [ownerId]
    ),
    db.query<ChoiceBackupRow>(
      `SELECT choice.*, cut.episode_id
       FROM promptoon_choice AS choice
       INNER JOIN promptoon_cut AS cut ON cut.id = choice.cut_id
       INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
       INNER JOIN promptoon_project AS project ON project.id = episode.project_id
       WHERE project.created_by = $1
       ORDER BY cut.episode_id ASC, choice.cut_id ASC, choice.order_index ASC, choice.created_at ASC`,
      [ownerId]
    ),
    db.query<PublishRow>(
      `SELECT publish.*
       FROM promptoon_publish AS publish
       INNER JOIN promptoon_project AS project ON project.id = publish.project_id
       WHERE project.created_by = $1
       ORDER BY publish.project_id ASC, publish.episode_id ASC, publish.version_no ASC, publish.created_at ASC`,
      [ownerId]
    ),
    db.query<ViewerEventRow>(
      `SELECT event.*
       FROM promptoon_viewer_event AS event
       INNER JOIN promptoon_episode AS episode ON episode.id = event.episode_id
       INNER JOIN promptoon_project AS project ON project.id = episode.project_id
       WHERE project.created_by = $1
       ORDER BY event.episode_id ASC, event.created_at ASC, event.id ASC`,
      [ownerId]
    )
  ]);
  const episodesByProjectId = groupByKey(episodesResult.rows.map(mapEpisode), (episode) => episode.projectId);
  const cutsByEpisodeId = groupByKey(cutsResult.rows.map(mapCut), (cut) => cut.episodeId);
  const choicesByEpisodeId = groupByKey(
    choicesResult.rows.map((row) => ({
      episodeId: row.episode_id,
      choice: mapBackupChoice(row)
    })),
    (entry) => entry.episodeId
  );
  const publishesByEpisodeId = groupByKey(publishesResult.rows.map(mapPublish), (publish) => publish.episodeId);
  const viewerEventsByEpisodeId = groupByKey(viewerEventsResult.rows.map(mapViewerEvent), (event) => event.episodeId);

  return projectsResult.rows.map((projectRow) => {
    const project = mapProject(projectRow);
    const episodes = episodesByProjectId.get(project.id) ?? [];

    return {
      project,
      episodes: episodes.map((episode) => ({
        episode,
        cuts: cutsByEpisodeId.get(episode.id) ?? [],
        choices: (choicesByEpisodeId.get(episode.id) ?? []).map((entry) => entry.choice),
        publishes: publishesByEpisodeId.get(episode.id) ?? [],
        viewerEvents: viewerEventsByEpisodeId.get(episode.id) ?? []
      }))
    };
  });
}

export async function createProject(
  db: DbExecutor,
  input: { title: string; description?: string; createdBy: string }
): Promise<Project> {
  const result = await db.query<ProjectRow>(
    `INSERT INTO promptoon_project (id, title, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [randomUUID(), input.title, input.description ?? null, input.createdBy]
  );

  return mapProject(result.rows[0]);
}

export async function updateProject(
  db: DbExecutor,
  projectId: string,
  patch: { title?: string; description?: string | null; thumbnailUrl?: string | null }
): Promise<Project | null> {
  const existing = await getProjectById(db, projectId);
  if (!existing) {
    return null;
  }

  const result = await db.query<ProjectRow>(
    `UPDATE promptoon_project
     SET title = $2,
         description = $3,
         thumbnail_url = $4,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      projectId,
      Object.prototype.hasOwnProperty.call(patch, 'title') ? patch.title : existing.title,
      Object.prototype.hasOwnProperty.call(patch, 'description') ? patch.description ?? null : existing.description,
      Object.prototype.hasOwnProperty.call(patch, 'thumbnailUrl') ? patch.thumbnailUrl ?? null : existing.thumbnailUrl
    ]
  );

  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function getProjectById(db: DbExecutor, projectId: string): Promise<Project | null> {
  const result = await db.query<ProjectRow>('SELECT * FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function listProjectAssets(db: DbExecutor, projectId: string): Promise<ProjectAssetListResponse> {
  const result = await db.query<ProjectAssetRow>(
    `SELECT project.thumbnail_url AS asset_url,
            'project_thumbnail' AS source,
            NULL::uuid AS episode_id,
            NULL::text AS episode_title,
            NULL::uuid AS cut_id,
            NULL::text AS cut_title,
            project.updated_at
       FROM promptoon_project AS project
      WHERE project.id = $1
        AND project.thumbnail_url IS NOT NULL
     UNION ALL
     SELECT episode.cover_image_url AS asset_url,
            'episode_cover' AS source,
            episode.id AS episode_id,
            episode.title AS episode_title,
            NULL::uuid AS cut_id,
            NULL::text AS cut_title,
            episode.updated_at
       FROM promptoon_episode AS episode
      WHERE episode.project_id = $1
        AND episode.cover_image_url IS NOT NULL
     UNION ALL
     SELECT cut.asset_url AS asset_url,
            'cut_asset' AS source,
            episode.id AS episode_id,
            episode.title AS episode_title,
            cut.id AS cut_id,
            cut.title AS cut_title,
            cut.updated_at
       FROM promptoon_cut AS cut
       INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
      WHERE episode.project_id = $1
        AND cut.asset_url IS NOT NULL
      ORDER BY updated_at DESC`,
    [projectId]
  );

  return {
    projectId,
    assets: result.rows.map((row) => ({
      assetUrl: row.asset_url,
      source: row.source,
      episodeId: row.episode_id,
      episodeTitle: row.episode_title,
      cutId: row.cut_id,
      cutTitle: row.cut_title,
      updatedAt: toIsoString(row.updated_at)
    }))
  };
}

export async function listProjectPublishHistory(db: DbExecutor, projectId: string): Promise<ProjectPublishHistoryResponse> {
  const result = await db.query<ProjectPublishHistoryRow>(
    `SELECT publish.id::text AS publish_id,
            publish.episode_id::text AS episode_id,
            episode.title AS episode_title,
            episode.episode_no,
            publish.version_no,
            publish.status,
            publish.created_at,
            publish.channel_id::text AS channel_id,
            publish.series_id::text AS series_id
       FROM promptoon_publish AS publish
       INNER JOIN promptoon_episode AS episode ON episode.id = publish.episode_id
      WHERE publish.project_id = $1
      ORDER BY publish.created_at DESC, publish.version_no DESC`,
    [projectId]
  );

  return {
    projectId,
    publishes: result.rows.map((row): ProjectPublishHistoryItem => ({
      publishId: row.publish_id,
      episodeId: row.episode_id,
      episodeTitle: row.episode_title,
      episodeNo: row.episode_no,
      versionNo: row.version_no,
      status: row.status,
      createdAt: toIsoString(row.created_at),
      channelId: row.channel_id,
      seriesId: row.series_id
    }))
  };
}

export async function getProjectOwnerId(db: DbExecutor, projectId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>('SELECT created_by FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0]?.created_by ?? null;
}

export async function getStudioMemberRole(db: DbExecutor, userId: string): Promise<import('@promptoon/shared').StudioRole | null> {
  const result = await db.query<{ role: import('@promptoon/shared').StudioRole }>(
    'SELECT role FROM promptoon_studio_member WHERE user_id = $1',
    [userId]
  );

  return result.rows[0]?.role ?? null;
}

export async function getProjectMemberRole(db: DbExecutor, input: { projectId: string; userId: string }): Promise<ProjectRole | null> {
  const result = await db.query<{ role: ProjectRole }>(
    'SELECT role FROM promptoon_project_member WHERE project_id = $1 AND user_id = $2',
    [input.projectId, input.userId]
  );

  return result.rows[0]?.role ?? null;
}

export async function listProjectMembers(db: DbExecutor, projectId: string): Promise<ProjectMemberSummary[]> {
  const result = await db.query<ProjectMemberRow>(
    `SELECT
       member.project_id,
       member.user_id,
       users.login_id,
       member.role,
       member.created_at
     FROM promptoon_project_member AS member
     INNER JOIN users ON users.id = member.user_id
     WHERE member.project_id = $1
     ORDER BY
       CASE member.role
         WHEN 'owner' THEN 0
         WHEN 'producer' THEN 1
         WHEN 'writer' THEN 2
         ELSE 3
       END,
       users.login_id ASC`,
    [projectId]
  );

  return result.rows.map(mapProjectMember);
}

export async function getUserIdByLoginId(db: DbExecutor, loginId: string): Promise<string | null> {
  const result = await db.query<{ id: string }>('SELECT id FROM users WHERE login_id = $1', [loginId]);
  return result.rows[0]?.id ?? null;
}

export async function deleteProjectMember(db: DbExecutor, input: { projectId: string; userId: string }): Promise<boolean> {
  const result = await db.query('DELETE FROM promptoon_project_member WHERE project_id = $1 AND user_id = $2', [
    input.projectId,
    input.userId
  ]);

  return (result.rowCount ?? 0) > 0;
}

export async function createEpisode(
  db: DbExecutor,
  input: {
    projectId: string;
    title: string;
    episodeNo: number;
    coverImageUrl?: string | null;
    mode?: PromptoonEpisodeMode;
    exitLoopMetadata?: ExitLoopEpisodeMetadata | null;
  }
): Promise<Episode> {
  const result = await db.query<EpisodeRow>(
    `INSERT INTO promptoon_episode (id, project_id, title, episode_no, cover_image_url, mode, exit_loop_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      randomUUID(),
      input.projectId,
      input.title,
      input.episodeNo,
      input.coverImageUrl ?? null,
      input.mode ?? 'standard',
      input.exitLoopMetadata ? JSON.stringify(input.exitLoopMetadata) : null
    ]
  );

  return mapEpisode(result.rows[0]);
}

export async function getEpisodeById(db: DbExecutor, episodeId: string): Promise<Episode | null> {
  const result = await db.query<EpisodeRow>('SELECT * FROM promptoon_episode WHERE id = $1', [episodeId]);
  return result.rows[0] ? mapEpisode(result.rows[0]) : null;
}

export async function updateEpisode(
  db: DbExecutor,
  episodeId: string,
  patch: Partial<{
    title: string;
    coverImageUrl: string | null;
    mode: PromptoonEpisodeMode;
    exitLoopMetadata: ExitLoopEpisodeMetadata | null;
  }>
): Promise<Episode | null> {
  const existing = await getEpisodeById(db, episodeId);
  if (!existing) {
    return null;
  }

  const nextCoverImageUrl = Object.prototype.hasOwnProperty.call(patch, 'coverImageUrl')
    ? patch.coverImageUrl ?? null
    : existing.coverImageUrl;
  const nextExitLoopMetadata = Object.prototype.hasOwnProperty.call(patch, 'exitLoopMetadata')
    ? patch.exitLoopMetadata ?? null
    : existing.exitLoopMetadata;
  const result = await db.query<EpisodeRow>(
    `UPDATE promptoon_episode
     SET title = $1,
         cover_image_url = $2,
         mode = $3,
         exit_loop_metadata = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      patch.title ?? existing.title,
      nextCoverImageUrl,
      patch.mode ?? existing.mode,
      nextExitLoopMetadata ? JSON.stringify(nextExitLoopMetadata) : null,
      episodeId
    ]
  );

  return result.rows[0] ? mapEpisode(result.rows[0]) : null;
}

export async function getEpisodeOwnerId(db: DbExecutor, episodeId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>(
    `SELECT project.created_by
     FROM promptoon_episode AS episode
     INNER JOIN promptoon_project AS project ON project.id = episode.project_id
     WHERE episode.id = $1`,
    [episodeId]
  );

  return result.rows[0]?.created_by ?? null;
}

export async function getEpisodeProjectId(db: DbExecutor, episodeId: string): Promise<string | null> {
  const result = await db.query<{ project_id: string }>('SELECT project_id FROM promptoon_episode WHERE id = $1', [episodeId]);
  return result.rows[0]?.project_id ?? null;
}

export async function getEpisodeDraft(db: DbExecutor, episodeId: string): Promise<EpisodeDraftResponse | null> {
  const episodeResult = await db.query<EpisodeRow>('SELECT * FROM promptoon_episode WHERE id = $1', [episodeId]);
  const episodeRow = episodeResult.rows[0];

  if (!episodeRow) {
    return null;
  }

  const cutsResult = await db.query<CutRow>(
    'SELECT * FROM promptoon_cut WHERE episode_id = $1 ORDER BY order_index ASC, created_at ASC',
    [episodeId]
  );
  const choicesResult = await db.query<ChoiceRow>(
    `SELECT choice.*
     FROM promptoon_choice AS choice
     INNER JOIN promptoon_cut AS cut ON cut.id = choice.cut_id
     WHERE cut.episode_id = $1
     ORDER BY choice.order_index ASC, choice.created_at ASC`,
    [episodeId]
  );

  return {
    episode: mapEpisode(episodeRow),
    cuts: cutsResult.rows.map(mapCut),
    choices: choicesResult.rows.map(mapChoice)
  };
}

export async function getCutById(db: DbExecutor, cutId: string): Promise<Cut | null> {
  const result = await db.query<CutRow>('SELECT * FROM promptoon_cut WHERE id = $1', [cutId]);
  return result.rows[0] ? mapCut(result.rows[0]) : null;
}

export async function getCutOwnerId(db: DbExecutor, cutId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>(
    `SELECT project.created_by
     FROM promptoon_cut AS cut
     INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
     INNER JOIN promptoon_project AS project ON project.id = episode.project_id
     WHERE cut.id = $1`,
    [cutId]
  );

  return result.rows[0]?.created_by ?? null;
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

export async function getChoiceById(db: DbExecutor, choiceId: string): Promise<Choice | null> {
  const result = await db.query<ChoiceRow>('SELECT * FROM promptoon_choice WHERE id = $1', [choiceId]);
  return result.rows[0] ? mapChoice(result.rows[0]) : null;
}

export async function countChoicesForCut(db: DbExecutor, cutId: string): Promise<number> {
  const result = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_choice WHERE cut_id = $1', [cutId]);
  return Number(result.rows[0]?.count ?? '0');
}

export async function getChoiceOwnerId(db: DbExecutor, choiceId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>(
    `SELECT project.created_by
     FROM promptoon_choice AS choice
     INNER JOIN promptoon_cut AS cut ON cut.id = choice.cut_id
     INNER JOIN promptoon_episode AS episode ON episode.id = cut.episode_id
     INNER JOIN promptoon_project AS project ON project.id = episode.project_id
     WHERE choice.id = $1`,
    [choiceId]
  );

  return result.rows[0]?.created_by ?? null;
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

export async function createCut(
  db: DbExecutor,
  input: {
    episodeId: string;
    kind: Cut['kind'];
    title: string;
    body?: string;
    contentBlocks?: CutContentBlock[];
    contentViewMode?: Cut['contentViewMode'];
    stateVariants?: CutStateVariant[];
    stateRoutes?: CutStateRoute[];
    stateFallbackCutId?: string | null;
    loopMetadata?: Cut['loopMetadata'] | null;
    dialogAnchorX?: Cut['dialogAnchorX'];
    dialogAnchorY?: Cut['dialogAnchorY'];
    dialogOffsetX?: number;
    dialogOffsetY?: number;
    dialogTextAlign?: Cut['dialogTextAlign'];
    startEffect?: Cut['startEffect'];
    endEffect?: Cut['endEffect'];
    startEffectDurationMs?: number;
    endEffectDurationMs?: number;
    assetUrl?: string | null;
    edgeFade?: Cut['edgeFade'];
    edgeFadeIntensity?: Cut['edgeFadeIntensity'];
    edgeFadeColor?: Cut['edgeFadeColor'];
    marginBottomToken?: Cut['marginBottomToken'];
    orderIndex?: number;
    positionX?: number;
    positionY?: number;
    isStart?: boolean;
    isEnding?: boolean;
  }
): Promise<Cut> {
  const countResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_cut WHERE episode_id = $1', [
    input.episodeId
  ]);
  const count = Number(countResult.rows[0].count);
  const defaultOrderIndex = count;
  const defaultPositionX = count * 200;
  const defaultPositionY = 100;

  const result = await db.query<CutRow>(
    `INSERT INTO promptoon_cut (
      id, episode_id, kind, title, body, content_blocks, content_view_mode, state_variants, state_routes, state_fallback_cut_id, loop_metadata, dialog_anchor_x, dialog_anchor_y, dialog_offset_x, dialog_offset_y, dialog_text_align,
      start_effect, end_effect, start_effect_duration_ms, end_effect_duration_ms, asset_url, edge_fade, edge_fade_intensity, edge_fade_color, margin_bottom_token, position_x, position_y, order_index, is_start, is_ending
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
     RETURNING *`,
    [
      randomUUID(),
      input.episodeId,
      input.kind,
      input.title,
      input.body ?? '',
      JSON.stringify(input.contentBlocks ?? []),
      input.contentViewMode ?? 'default',
      JSON.stringify(input.stateVariants ?? []),
      JSON.stringify(input.stateRoutes ?? []),
      input.stateFallbackCutId ?? null,
      input.loopMetadata ? JSON.stringify(input.loopMetadata) : null,
      input.dialogAnchorX ?? 'left',
      input.dialogAnchorY ?? 'bottom',
      input.dialogOffsetX ?? 0,
      input.dialogOffsetY ?? 0,
      input.dialogTextAlign ?? 'left',
      input.startEffect ?? 'none',
      input.endEffect ?? 'none',
      input.startEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS,
      input.endEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS,
      input.assetUrl ?? null,
      input.edgeFade ?? DEFAULT_EDGE_FADE,
      input.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
      input.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
      input.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
      input.positionX ?? defaultPositionX,
      input.positionY ?? defaultPositionY,
      input.orderIndex ?? defaultOrderIndex,
      input.isStart ?? false,
      input.isEnding ?? (input.kind === 'ending' || input.kind === 'resultCard')
    ]
  );

  const createdCut = mapCut(result.rows[0]);

  if (createdCut.isStart) {
    await db.query('UPDATE promptoon_episode SET start_cut_id = $1, updated_at = NOW() WHERE id = $2', [
      createdCut.id,
      createdCut.episodeId
    ]);
  }

  return createdCut;
}

export async function updateCut(
  db: DbExecutor,
  cutId: string,
  patch: Partial<{
    kind: Cut['kind'];
    title: string;
    body: string;
    contentBlocks: CutContentBlock[];
    contentViewMode: Cut['contentViewMode'];
    stateVariants: CutStateVariant[];
    stateRoutes: CutStateRoute[];
    stateFallbackCutId: string | null;
    loopMetadata: Cut['loopMetadata'] | null;
    dialogAnchorX: Cut['dialogAnchorX'];
    dialogAnchorY: Cut['dialogAnchorY'];
    dialogOffsetX: number;
    dialogOffsetY: number;
    dialogTextAlign: Cut['dialogTextAlign'];
    startEffect: Cut['startEffect'];
    endEffect: Cut['endEffect'];
    startEffectDurationMs: number;
    endEffectDurationMs: number;
    assetUrl: string | null;
    edgeFade: Cut['edgeFade'];
    edgeFadeIntensity: Cut['edgeFadeIntensity'];
    edgeFadeColor: Cut['edgeFadeColor'];
    marginBottomToken: Cut['marginBottomToken'];
    orderIndex: number;
    positionX: number;
    positionY: number;
    isStart: boolean;
    isEnding: boolean;
  }>
): Promise<Cut | null> {
  const existing = await getCutById(db, cutId);
  if (!existing) {
    return null;
  }

  const nextAssetUrl = Object.prototype.hasOwnProperty.call(patch, 'assetUrl') ? patch.assetUrl ?? null : existing.assetUrl;
  const nextStateFallbackCutId = Object.prototype.hasOwnProperty.call(patch, 'stateFallbackCutId')
    ? patch.stateFallbackCutId ?? null
    : existing.stateFallbackCutId ?? null;
  const nextLoopMetadata = Object.prototype.hasOwnProperty.call(patch, 'loopMetadata')
    ? patch.loopMetadata ?? null
    : existing.loopMetadata ?? null;
  const nextIsEnding =
    patch.isEnding !== undefined
      ? patch.isEnding
      : patch.kind === 'ending' || patch.kind === 'resultCard'
        ? true
        : existing.isEnding;
  const result = await db.query<CutRow>(
    `UPDATE promptoon_cut
     SET kind = $1,
         title = $2,
         body = $3,
         content_blocks = $4::jsonb,
         content_view_mode = $5,
         state_variants = $6::jsonb,
         state_routes = $7::jsonb,
         state_fallback_cut_id = $8,
         loop_metadata = $9::jsonb,
         dialog_anchor_x = $10,
         dialog_anchor_y = $11,
         dialog_offset_x = $12,
         dialog_offset_y = $13,
         dialog_text_align = $14,
         start_effect = $15,
         end_effect = $16,
         start_effect_duration_ms = $17,
         end_effect_duration_ms = $18,
         asset_url = $19,
         edge_fade = $20,
         edge_fade_intensity = $21,
         edge_fade_color = $22,
         margin_bottom_token = $23,
         position_x = $24,
         position_y = $25,
         order_index = $26,
         is_start = $27,
         is_ending = $28,
         updated_at = NOW()
     WHERE id = $29
     RETURNING *`,
    [
      patch.kind ?? existing.kind,
      patch.title ?? existing.title,
      patch.body ?? existing.body,
      JSON.stringify(patch.contentBlocks ?? existing.contentBlocks),
      patch.contentViewMode ?? existing.contentViewMode ?? 'default',
      JSON.stringify(patch.stateVariants ?? existing.stateVariants),
      JSON.stringify(patch.stateRoutes ?? existing.stateRoutes),
      nextStateFallbackCutId,
      nextLoopMetadata ? JSON.stringify(nextLoopMetadata) : null,
      patch.dialogAnchorX ?? existing.dialogAnchorX,
      patch.dialogAnchorY ?? existing.dialogAnchorY,
      patch.dialogOffsetX ?? existing.dialogOffsetX,
      patch.dialogOffsetY ?? existing.dialogOffsetY,
      patch.dialogTextAlign ?? existing.dialogTextAlign,
      patch.startEffect ?? existing.startEffect,
      patch.endEffect ?? existing.endEffect,
      patch.startEffectDurationMs ?? existing.startEffectDurationMs,
      patch.endEffectDurationMs ?? existing.endEffectDurationMs,
      nextAssetUrl,
      patch.edgeFade ?? existing.edgeFade ?? DEFAULT_EDGE_FADE,
      patch.edgeFadeIntensity ?? existing.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
      patch.edgeFadeColor ?? existing.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
      patch.marginBottomToken ?? existing.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
      patch.positionX ?? existing.positionX,
      patch.positionY ?? existing.positionY,
      patch.orderIndex ?? existing.orderIndex,
      patch.isStart ?? existing.isStart,
      nextIsEnding,
      cutId
    ]
  );

  const updated = mapCut(result.rows[0]);

  if (updated.isStart) {
    await db.query('UPDATE promptoon_episode SET start_cut_id = $1, updated_at = NOW() WHERE id = $2', [
      updated.id,
      updated.episodeId
    ]);
  } else if (existing.isStart) {
    await db.query(
      'UPDATE promptoon_episode SET start_cut_id = NULL, updated_at = NOW() WHERE id = $1 AND start_cut_id = $2',
      [updated.episodeId, updated.id]
    );
  }

  return updated;
}

export async function deleteCut(db: DbExecutor, cutId: string): Promise<boolean> {
  const cut = await getCutById(db, cutId);
  if (!cut) {
    return false;
  }

  await db.query('DELETE FROM promptoon_cut WHERE id = $1', [cutId]);
  await db.query(
    'UPDATE promptoon_episode SET start_cut_id = NULL, updated_at = NOW() WHERE id = $1 AND start_cut_id = $2',
    [cut.episodeId, cutId]
  );
  return true;
}

export async function listLoopStateSettingCuts(db: DbExecutor, episodeId: string, groupId: string): Promise<Cut[]> {
  const result = await db.query<CutRow>(
    `SELECT *
     FROM promptoon_cut
     WHERE episode_id = $1
       AND loop_metadata->>'kind' = 'exitLoop'
       AND loop_metadata->>'groupId' = $2
     ORDER BY order_index ASC, created_at ASC`,
    [episodeId, groupId]
  );

  return result.rows.map(mapCut);
}

export async function deleteChoicesTargetingCuts(
  db: DbExecutor,
  input: {
    episodeId: string;
    cutIds: string[];
  }
): Promise<number> {
  if (input.cutIds.length === 0) {
    return 0;
  }

  const result = await db.query(
    `DELETE FROM promptoon_choice AS choice
     USING promptoon_cut AS source_cut
     WHERE choice.cut_id = source_cut.id
       AND source_cut.episode_id = $2
       AND choice.next_cut_id::text = ANY($1::text[])
       AND choice.cut_id::text <> ALL($1::text[])`,
    [input.cutIds, input.episodeId]
  );

  return result.rowCount ?? 0;
}

export async function removeStateVariantsTargetingCuts(
  db: DbExecutor,
  input: {
    episodeId: string;
    cutIds: string[];
  }
): Promise<void> {
  if (input.cutIds.length === 0) {
    return;
  }

  await db.query(
    `UPDATE promptoon_cut
     SET state_variants = COALESCE(
           (
             SELECT jsonb_agg(state_variant.value)
             FROM jsonb_array_elements(COALESCE(state_variants, '[]'::jsonb)) AS state_variant(value)
             WHERE COALESCE(state_variant.value->>'variantCutId', '') <> ALL($1::text[])
           ),
           '[]'::jsonb
         ),
         updated_at = NOW()
     WHERE episode_id = $2`,
    [input.cutIds, input.episodeId]
  );
}

export async function removeStateRoutesTargetingCuts(
  db: DbExecutor,
  input: {
    episodeId: string;
    cutIds: string[];
  }
): Promise<void> {
  if (input.cutIds.length === 0) {
    return;
  }

  await db.query(
    `UPDATE promptoon_cut
     SET state_routes = COALESCE(
           (
             SELECT jsonb_agg(state_route.value)
             FROM jsonb_array_elements(COALESCE(state_routes, '[]'::jsonb)) AS state_route(value)
             WHERE COALESCE(state_route.value->>'nextCutId', '') <> ALL($1::text[])
           ),
           '[]'::jsonb
         ),
         state_fallback_cut_id = CASE
           WHEN state_fallback_cut_id::text = ANY($1::text[]) THEN NULL
           ELSE state_fallback_cut_id
         END,
         updated_at = NOW()
     WHERE episode_id = $2`,
    [input.cutIds, input.episodeId]
  );
}

export async function deleteLoopStateSettingCuts(db: DbExecutor, episodeId: string, groupId: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM promptoon_cut
     WHERE episode_id = $1
       AND loop_metadata->>'kind' = 'exitLoop'
       AND loop_metadata->>'groupId' = $2`,
    [episodeId, groupId]
  );

  return result.rowCount ?? 0;
}

export async function reconnectChoicesTargetingCut(
  db: DbExecutor,
  input: {
    cutId: string;
    reconnectToCutId: string | null;
  }
): Promise<void> {
  await db.query(
    `UPDATE promptoon_choice
     SET next_cut_id = $2,
         updated_at = NOW()
     WHERE next_cut_id = $1`,
    [input.cutId, input.reconnectToCutId]
  );
}

export async function removeStateVariantsTargetingCut(db: DbExecutor, input: { episodeId: string; cutId: string }): Promise<void> {
  await db.query(
    `UPDATE promptoon_cut
     SET state_variants = COALESCE(
           (
             SELECT jsonb_agg(state_variant.value)
             FROM jsonb_array_elements(COALESCE(state_variants, '[]'::jsonb)) AS state_variant(value)
             WHERE state_variant.value->>'variantCutId' <> $1
           ),
           '[]'::jsonb
         ),
         updated_at = NOW()
     WHERE episode_id = $2`,
    [input.cutId, input.episodeId]
  );
}

export async function removeStateRoutesTargetingCut(db: DbExecutor, input: { episodeId: string; cutId: string }): Promise<void> {
  await db.query(
    `UPDATE promptoon_cut
     SET state_routes = COALESCE(
           (
             SELECT jsonb_agg(state_route.value)
             FROM jsonb_array_elements(COALESCE(state_routes, '[]'::jsonb)) AS state_route(value)
             WHERE state_route.value->>'nextCutId' <> $1
           ),
           '[]'::jsonb
         ),
         state_fallback_cut_id = CASE WHEN state_fallback_cut_id = $1::uuid THEN NULL ELSE state_fallback_cut_id END,
         updated_at = NOW()
     WHERE episode_id = $2`,
    [input.cutId, input.episodeId]
  );
}

export async function createChoice(
  db: DbExecutor,
  input: {
    cutId: string;
    label: string;
    orderIndex?: number;
    nextCutId?: string | null;
    afterSelectReactionText?: string;
    stateWrites?: ChoiceStateWrite[];
  }
): Promise<Choice> {
  const countResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_choice WHERE cut_id = $1', [
    input.cutId
  ]);
  const defaultOrderIndex = Number(countResult.rows[0].count);
  const result = await db.query<ChoiceRow>(
    `INSERT INTO promptoon_choice (id, cut_id, label, order_index, next_cut_id, after_select_reaction_text, state_writes)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      randomUUID(),
      input.cutId,
      input.label,
      input.orderIndex ?? defaultOrderIndex,
      input.nextCutId ?? null,
      input.afterSelectReactionText?.trim() ? input.afterSelectReactionText : null,
      JSON.stringify(input.stateWrites ?? [])
    ]
  );
  return mapChoice(result.rows[0]);
}

export async function updateChoice(
  db: DbExecutor,
  choiceId: string,
  patch: Partial<{
    label: string;
    orderIndex: number;
    nextCutId: string | null;
    afterSelectReactionText: string;
    stateWrites: ChoiceStateWrite[];
  }>
): Promise<Choice | null> {
  const existing = await getChoiceById(db, choiceId);
  if (!existing) {
    return null;
  }

  const nextCutId = Object.prototype.hasOwnProperty.call(patch, 'nextCutId') ? patch.nextCutId ?? null : existing.nextCutId;
  const nextReactionText = Object.prototype.hasOwnProperty.call(patch, 'afterSelectReactionText')
    ? patch.afterSelectReactionText?.trim()
      ? patch.afterSelectReactionText
      : null
    : existing.afterSelectReactionText ?? null;
  const result = await db.query<ChoiceRow>(
    `UPDATE promptoon_choice
     SET label = $1,
         order_index = $2,
         next_cut_id = $3,
         after_select_reaction_text = $4,
         state_writes = $5::jsonb,
         updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [
      patch.label ?? existing.label,
      patch.orderIndex ?? existing.orderIndex,
      nextCutId,
      nextReactionText,
      JSON.stringify(patch.stateWrites ?? existing.stateWrites),
      choiceId
    ]
  );

  return mapChoice(result.rows[0]);
}

export async function deleteChoice(db: DbExecutor, choiceId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM promptoon_choice WHERE id = $1', [choiceId]);
  return (result.rowCount ?? 0) > 0;
}

export async function reorderEpisodeCuts(
  db: DbExecutor,
  episodeId: string,
  input: ReorderEpisodeCutsRequest
): Promise<Cut[]> {
  const cutIds = input.cuts.map((cut) => cut.cutId);
  const membershipResult = await db.query<{ id: string }>(
    'SELECT id FROM promptoon_cut WHERE episode_id = $1 ORDER BY order_index ASC, created_at ASC',
    [episodeId]
  );
  const existingCutIds = membershipResult.rows.map((row) => row.id);

  if (existingCutIds.length !== cutIds.length) {
    return [];
  }

  const existingCutIdSet = new Set(existingCutIds);
  for (const cutId of cutIds) {
    if (!existingCutIdSet.has(cutId)) {
      return [];
    }
  }

  const caseClauses: string[] = [];
  const values: unknown[] = [episodeId];
  for (const cut of input.cuts) {
    values.push(cut.cutId, cut.orderIndex);
    caseClauses.push(`WHEN $${values.length - 1}::uuid THEN $${values.length}::integer`);
  }

  values.push(cutIds);
  const idsParamIndex = values.length;

  const result = await db.query<CutRow>(
    `UPDATE promptoon_cut
     SET order_index = CASE id ${caseClauses.join(' ')} END,
         updated_at = NOW()
     WHERE episode_id = $1
       AND id = ANY($${idsParamIndex}::uuid[])
     RETURNING *`,
    values
  );

  return result.rows.map(mapCut).sort((left, right) => left.orderIndex - right.orderIndex);
}

export async function updateEpisodeCutLayout(
  db: DbExecutor,
  episodeId: string,
  input: PatchEpisodeCutLayoutRequest
): Promise<Cut[]> {
  const cutIds = input.cuts.map((cut) => cut.cutId);
  const caseXClauses: string[] = [];
  const caseYClauses: string[] = [];
  const values: unknown[] = [episodeId];

  for (const cut of input.cuts) {
    values.push(cut.cutId, cut.positionX, cut.positionY);
    caseXClauses.push(`WHEN $${values.length - 2}::uuid THEN $${values.length - 1}::double precision`);
    caseYClauses.push(`WHEN $${values.length - 2}::uuid THEN $${values.length}::double precision`);
  }

  values.push(cutIds);
  const idsParamIndex = values.length;

  const result = await db.query<CutRow>(
    `UPDATE promptoon_cut
     SET position_x = CASE id ${caseXClauses.join(' ')} END,
         position_y = CASE id ${caseYClauses.join(' ')} END,
         updated_at = NOW()
     WHERE episode_id = $1
       AND id = ANY($${idsParamIndex}::uuid[])
     RETURNING *`,
    values
  );

  return result.rows.map(mapCut).sort((left, right) => left.orderIndex - right.orderIndex);
}

export async function getLatestPublishVersion(db: DbExecutor, projectId: string, episodeId: string): Promise<number> {
  const result = await db.query<{ version_no: number }>(
    `SELECT version_no
     FROM promptoon_publish
     WHERE project_id = $1 AND episode_id = $2
     ORDER BY version_no DESC
     LIMIT 1`,
    [projectId, episodeId]
  );

  return result.rows[0]?.version_no ?? 0;
}

export async function getPublishById(db: DbExecutor, publishId: string): Promise<Publish | null> {
  const result = await db.query<PublishRow>('SELECT * FROM promptoon_publish WHERE id = $1', [publishId]);
  return result.rows[0] ? mapPublish(result.rows[0]) : null;
}

export async function getLatestPublishByEpisodeId(db: DbExecutor, episodeId: string): Promise<Publish | null> {
  const result = await db.query<PublishRow>(
    `SELECT *
       FROM promptoon_publish
      WHERE episode_id = $1
        AND status = 'published'
      ORDER BY version_no DESC, created_at DESC
      LIMIT 1`,
    [episodeId]
  );

  return result.rows[0] ? mapPublish(result.rows[0]) : null;
}

export async function listLatestPublishesForFeed(
  db: DbExecutor,
  input: {
    cursor?: FeedCursorInput;
    limit: number;
  }
): Promise<Publish[]> {
  const values: unknown[] = [];
  const cursorClause = input.cursor
    ? (() => {
        values.push(input.cursor.createdAt, input.cursor.publishId);
        return `AND (created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`;
      })()
    : '';

  values.push(input.limit);

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
       ${cursorClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map(mapPublish);
}

export async function listLatestPublishesForProjectionRebuild(db: DbExecutor): Promise<Publish[]> {
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
     ORDER BY created_at DESC, id DESC`
  );

  return result.rows.map(mapPublish);
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

export async function ensureDefaultChannelForProject(db: DbExecutor, project: Project, ownerUserId: string): Promise<ChannelRow> {
  const channelOwnerId = project.createdBy || ownerUserId;
  const existing = await db.query<ChannelRow>(
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
  const result = await db.query<ChannelRow>(
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

export async function ensureDefaultSeriesForProject(
  db: DbExecutor,
  input: {
    project: Project;
    channelId: string;
  }
): Promise<SeriesRow> {
  const existing = await db.query<SeriesRow>('SELECT * FROM promptoon_series WHERE project_id = $1 ORDER BY sort_order, created_at LIMIT 1', [
    input.project.id
  ]);
  if (existing.rows[0]) {
    if (existing.rows[0].channel_id !== input.channelId) {
      const updated = await db.query<SeriesRow>(
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

  const result = await db.query<SeriesRow>(
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

export async function upsertProjectMember(
  db: DbExecutor,
  input: {
    projectId: string;
    userId: string;
    role: ProjectRole;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_project_member (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE
       SET role = EXCLUDED.role`,
    [input.projectId, input.userId, input.role]
  );
}

export async function upsertFeedItemProjection(
  db: DbExecutor,
  input: {
    publish: Publish;
    feedItem: import('@promptoon/shared').FeedItem;
    channel: ChannelRow;
    series: SeriesRow;
  }
): Promise<void> {
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
    limit: number;
    userId?: string;
  }
): Promise<Array<{ id: string; publishedAt: string; item: import('@promptoon/shared').FeedItem }>> {
  const values: unknown[] = [];
  const whereClauses: string[] = [];
  if (input.cursor) {
    values.push(input.cursor.createdAt, input.cursor.publishId);
    whereClauses.push(`(published_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  const accessUserParam = input.userId ? `$${values.push(input.userId)}` : undefined;
  whereClauses.push(buildFeedItemAccessPredicate('promptoon_feed_item', accessUserParam));
  const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

  values.push(input.limit);

  const result = await db.query<FeedItemProjectionRow>(
    `SELECT id, publish_id, project_id, channel_id, series_id, episode_id, metrics_json, payload_json, published_at,
       ${buildFeedItemExperimentalPredicate('promptoon_feed_item', accessUserParam)} AS is_experimental
     FROM promptoon_feed_item
     ${whereClause}
     ORDER BY published_at DESC, id DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows.map((row) => ({
    id: row.id,
    publishedAt: toIsoString(row.published_at),
    item: {
      ...row.payload_json,
      metrics: normalizeFeedMetrics(row.metrics_json ?? row.payload_json.metrics),
      ...(row.is_experimental ? { isExperimental: true } : {})
    }
  }));
}

export async function getPublishProjectionContext(db: DbExecutor, publishId: string): Promise<PublishProjectionContextRow | null> {
  const result = await db.query<PublishProjectionContextRow>(
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
       EXISTS (
         SELECT 1
         FROM promptoon_user_like AS user_like
         WHERE user_like.user_id = $2
           AND user_like.publish_id = requested.publish_id
       ) AS liked,
       EXISTS (
         SELECT 1
         FROM promptoon_user_bookmark AS bookmark
         WHERE bookmark.user_id = $2
           AND bookmark.publish_id = requested.publish_id
       ) AS bookmarked,
       COALESCE(item.metrics_json, item.payload_json->'metrics', '{"views":0,"likes":0,"comments":0,"shares":0}'::jsonb) AS metrics_json
     FROM requested
     JOIN promptoon_publish AS publish ON publish.id = requested.publish_id
     LEFT JOIN promptoon_feed_item AS item ON item.publish_id = requested.publish_id
     ORDER BY array_position($1::uuid[], requested.publish_id)`,
    [input.publishIds, input.userId]
  );

  return result.rows.map((row) => ({
    publishId: row.publish_id,
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

export async function refreshFeedItemLikeMetrics(db: DbExecutor, publishId: string): Promise<PublishProjectionContextRow | null> {
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

export async function getChannelBySlug(db: DbExecutor, slug: string): Promise<ChannelRow | null> {
  const result = await db.query<ChannelRow>('SELECT * FROM promptoon_channel WHERE slug = $1 AND visibility = $2', [slug, 'public']);
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
  const channelResult = await db.query<ChannelRow>('SELECT * FROM promptoon_channel WHERE id = $1', [channelId]);
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

  const seriesResult = await db.query<SeriesRow>(
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
  }>(
    `SELECT id, title, thumbnail_url, video_url, duration_sec, publish_id
     FROM promptoon_short_clip
     WHERE channel_id = $1 AND status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT 8`,
    [channelId]
  );

  const profile = mapChannelProfile(channel, {
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
      publishId: short.publish_id
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

export async function getCommentsMetaByPublishId(db: DbExecutor, publishId: string): Promise<CommentsMetaRow | null> {
  const result = await db.query<CommentsMetaRow>(
    `SELECT publish_id, comment_count, latest_comment_at, discussion_url
     FROM promptoon_episode_discussion
     WHERE publish_id = $1`,
    [publishId]
  );

  return result.rows[0] ?? null;
}

export async function listRelatedShortsForPublish(
  db: DbExecutor,
  publishId: string,
  limit = 8
): Promise<import('@promptoon/shared').RelatedShort[]> {
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
    href: row.publish_id ? `/v/${row.publish_id}` : row.channel_slug ? `/c/${row.channel_slug}/shorts` : '/feed'
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

export async function countViewerEvents(
  db: DbExecutor,
  input: {
    episodeId: string;
    eventType: TelemetryEventType;
    cutId?: string;
    distinctAnonymous?: boolean;
  }
): Promise<number> {
  const clauses = ['episode_id = $1', 'event_type = $2'];
  const values: unknown[] = [input.episodeId, input.eventType];

  if (input.cutId) {
    clauses.push(`cut_id = $${values.length + 1}`);
    values.push(input.cutId);
  }

  const result = await db.query<ViewerEventCountRow>(
    `SELECT COUNT(${input.distinctAnonymous ? 'DISTINCT anonymous_id' : '*'})::text AS count
     FROM promptoon_viewer_event
     WHERE ${clauses.join(' AND ')}`,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function getChoiceClickStats(db: DbExecutor, episodeId: string): Promise<Map<string, AnalyticsChoiceStat[]>> {
  const result = await db.query<ChoiceStatRow>(
    `SELECT
       event.cut_id,
       event.choice_id,
       choice.label,
       COUNT(*)::text AS count,
       ROUND(AVG(event.duration_ms))::text AS avg_hesitation_ms
     FROM promptoon_viewer_event AS event
     INNER JOIN promptoon_choice AS choice ON choice.id = event.choice_id
     WHERE event.episode_id = $1
       AND event.event_type = 'choice_click'
       AND event.choice_id IS NOT NULL
     GROUP BY event.cut_id, event.choice_id, choice.label
     ORDER BY event.cut_id ASC, count DESC, choice.label ASC`,
    [episodeId]
  );

  const grouped = new Map<string, AnalyticsChoiceStat[]>();

  for (const row of result.rows) {
    const list = grouped.get(row.cut_id) ?? [];
    list.push({
      choiceId: row.choice_id,
      label: row.label,
      count: Number(row.count),
      percentage: 0,
      avgHesitationMs: row.avg_hesitation_ms === null ? undefined : Number(row.avg_hesitation_ms)
    });
    grouped.set(row.cut_id, list);
  }

  for (const [cutId, stats] of grouped.entries()) {
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    grouped.set(
      cutId,
      stats.map((stat) => ({
        ...stat,
        percentage: total === 0 ? 0 : Number(((stat.count / total) * 100).toFixed(1))
      }))
    );
  }

  return grouped;
}

export async function getCutEngagementStats(db: DbExecutor, episodeId: string): Promise<Map<string, AnalyticsCutEngagement>> {
  const result = await db.query<CutEngagementRow>(
    `WITH cut_durations AS (
       SELECT
         cut_id,
         ROUND(AVG(duration_ms))::text AS avg_duration_ms
       FROM promptoon_viewer_event
       WHERE episode_id = $1
         AND event_type = 'cut_leave'
         AND duration_ms IS NOT NULL
       GROUP BY cut_id
     ),
     cut_dropoffs AS (
       SELECT
         viewed.cut_id,
         COUNT(*)::text AS drop_off_count
       FROM promptoon_viewer_event AS viewed
       WHERE viewed.episode_id = $1
         AND viewed.event_type = 'cut_view'
         AND viewed.session_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM promptoon_viewer_event AS next_event
           WHERE next_event.episode_id = viewed.episode_id
             AND next_event.session_id = viewed.session_id
             AND next_event.created_at > viewed.created_at
             AND next_event.event_type IN ('cut_view', 'choice_click', 'ending_reach')
         )
       GROUP BY viewed.cut_id
     )
     SELECT
       COALESCE(cut_durations.cut_id, cut_dropoffs.cut_id) AS cut_id,
       cut_dropoffs.drop_off_count,
       cut_durations.avg_duration_ms
     FROM cut_durations
     FULL OUTER JOIN cut_dropoffs ON cut_dropoffs.cut_id = cut_durations.cut_id`,
    [episodeId]
  );

  return new Map(
    result.rows.map((row) => [
      row.cut_id,
      {
        cutId: row.cut_id,
        dropOffCount: Number(row.drop_off_count ?? 0),
        avgDurationMs: Number(row.avg_duration_ms ?? 0)
      }
    ])
  );
}

export async function getEndingDistributionStats(db: DbExecutor, episodeId: string): Promise<AnalyticsEndingStat[]> {
  const result = await db.query<EndingStatRow>(
    `SELECT
       cut_id,
       COUNT(*)::text AS count
     FROM promptoon_viewer_event
     WHERE episode_id = $1
       AND event_type = 'ending_reach'
     GROUP BY cut_id
     ORDER BY count DESC, cut_id ASC`,
    [episodeId]
  );
  const total = result.rows.reduce((sum, row) => sum + Number(row.count), 0);

  return result.rows.map((row) => ({
    cutId: row.cut_id,
    count: Number(row.count),
    percentage: total === 0 ? 0 : Number(((Number(row.count) / total) * 100).toFixed(1))
  }));
}

export async function countReplayViewers(db: DbExecutor, input: { episodeId: string; startCutId: string }): Promise<number> {
  const result = await db.query<ViewerEventCountRow>(
    `SELECT COUNT(DISTINCT replay_start.anonymous_id)::text AS count
     FROM promptoon_viewer_event AS replay_start
     WHERE replay_start.episode_id = $1
       AND replay_start.event_type = 'cut_view'
       AND replay_start.cut_id = $2
       AND replay_start.session_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM promptoon_viewer_event AS prior_ending
         WHERE prior_ending.episode_id = replay_start.episode_id
           AND prior_ending.anonymous_id = replay_start.anonymous_id
           AND prior_ending.event_type = 'ending_reach'
           AND prior_ending.session_id IS NOT NULL
           AND prior_ending.session_id <> replay_start.session_id
           AND prior_ending.created_at < replay_start.created_at
       )`,
    [input.episodeId, input.startCutId]
  );

  return Number(result.rows[0]?.count ?? 0);
}

function getAnalyticsDateTruncUnit(granularity: AnalyticsViewGranularity): 'day' | 'week' | 'month' {
  if (granularity === 'weekly') {
    return 'week';
  }

  if (granularity === 'monthly') {
    return 'month';
  }

  return 'day';
}

export async function getStartViewsByPeriod(
  db: DbExecutor,
  input: { episodeId: string; startCutId: string; granularity: AnalyticsViewGranularity; fromDate: string; toDate?: string | null }
): Promise<AnalyticsViewPoint[]> {
  const truncUnit = getAnalyticsDateTruncUnit(input.granularity);
  const result = await db.query<ViewsByPeriodRow>(
    `SELECT
       TO_CHAR(DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS period_start,
       COUNT(*)::text AS views,
       COUNT(DISTINCT anonymous_id)::text AS unique_viewers
     FROM promptoon_viewer_event
     WHERE episode_id = $1
       AND event_type = 'cut_view'
       AND cut_id = $2
       AND created_at >= $3::timestamptz
       AND ($4::timestamptz IS NULL OR created_at < $4::timestamptz)
     GROUP BY DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'UTC')
     ORDER BY DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'UTC') ASC`,
    [input.episodeId, input.startCutId, input.fromDate, input.toDate ?? null]
  );

  return result.rows.map((row) => ({
    periodStart: row.period_start,
    views: Number(row.views),
    uniqueViewers: Number(row.unique_viewers)
  }));
}

export async function deleteViewerEventsForAnalyticsScope(
  db: DbExecutor,
  input: { episodeId: string; scope: AnalyticsResetScope; startCutId?: string | null }
): Promise<number> {
  const values: unknown[] = [input.episodeId];
  let filter = '';

  switch (input.scope) {
    case 'all':
      break;
    case 'views':
      if (!input.startCutId) {
        return 0;
      }
      values.push(input.startCutId);
      filter = ` AND event_type = 'cut_view' AND cut_id = $${values.length}`;
      break;
    case 'choiceStats':
      filter = " AND event_type = 'choice_click'";
      break;
    case 'endingDistribution':
      filter = " AND event_type = 'ending_reach'";
      break;
    case 'cutEngagement':
      filter = " AND event_type IN ('cut_view', 'cut_leave')";
      break;
    case 'feedEntry':
      filter = " AND event_type IN ('feed_impression', 'feed_choice_click')";
      break;
    default:
      return 0;
  }

  const result = await db.query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM promptoon_viewer_event
       WHERE episode_id = $1${filter}
       RETURNING 1
     )
     SELECT COUNT(*)::text AS count FROM deleted`,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function createPublish(
  db: DbExecutor,
  input: {
    projectId: string;
    episodeId: string;
    channelId?: string | null;
    seriesId?: string | null;
    versionNo: number;
    manifest: PublishManifest;
    createdBy: string;
  }
): Promise<Publish> {
  const result = await db.query<PublishRow>(
    `INSERT INTO promptoon_publish (id, project_id, episode_id, channel_id, series_id, version_no, status, manifest, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $8)
     RETURNING *`,
    [
      randomUUID(),
      input.projectId,
      input.episodeId,
      input.channelId ?? null,
      input.seriesId ?? null,
      input.versionNo,
      JSON.stringify(input.manifest),
      input.createdBy
    ]
  );

  return mapPublish(result.rows[0]);
}

export async function updateLatestPublishForEpisode(
  db: DbExecutor,
  input: {
    projectId: string;
    episodeId: string;
    channelId?: string | null;
    seriesId?: string | null;
    manifest: PublishManifest;
    createdBy: string;
  }
): Promise<Publish | null> {
  const result = await db.query<PublishRow>(
    `UPDATE promptoon_publish
     SET channel_id = $3,
         series_id = $4,
         manifest = $5,
         created_by = $6,
         status = 'published',
         created_at = NOW()
     WHERE id = (
       SELECT id
       FROM promptoon_publish
       WHERE project_id = $1
         AND episode_id = $2
         AND status = 'published'
       ORDER BY version_no DESC, created_at DESC, id DESC
       LIMIT 1
     )
     RETURNING *`,
    [input.projectId, input.episodeId, input.channelId ?? null, input.seriesId ?? null, JSON.stringify(input.manifest), input.createdBy]
  );

  return result.rows[0] ? mapPublish(result.rows[0]) : null;
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

export async function markProjectPublished(db: DbExecutor, projectId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_project
     SET status = 'published',
         updated_at = NOW()
     WHERE id = $1`,
    [projectId]
  );
}

export async function markProjectDraft(db: DbExecutor, projectId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_project
     SET status = 'draft',
         updated_at = NOW()
     WHERE id = $1`,
    [projectId]
  );
}

export async function markEpisodePublished(db: DbExecutor, episodeId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_episode
     SET status = 'published',
         updated_at = NOW()
     WHERE id = $1`,
    [episodeId]
  );
}

export async function markEpisodeDraft(db: DbExecutor, episodeId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_episode
     SET status = 'draft',
         updated_at = NOW()
     WHERE id = $1`,
    [episodeId]
  );
}

export async function markPublishesUnpublishedForEpisode(db: DbExecutor, projectId: string, episodeId: string): Promise<number> {
  const result = await db.query(
    `UPDATE promptoon_publish
     SET status = 'unpublished'
     WHERE project_id = $1
       AND episode_id = $2
       AND status = 'published'`,
    [projectId, episodeId]
  );

  return result.rowCount ?? 0;
}

export async function deletePublishesForEpisode(db: DbExecutor, projectId: string, episodeId: string): Promise<number> {
  const result = await db.query(
    `DELETE FROM promptoon_publish
     WHERE project_id = $1
       AND episode_id = $2`,
    [projectId, episodeId]
  );

  return result.rowCount ?? 0;
}

export async function projectHasPublishedEpisodes(db: DbExecutor, projectId: string): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM promptoon_publish
       WHERE project_id = $1
         AND status = 'published'
     )::boolean AS exists`,
    [projectId]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function lockEpisodeForPublish(db: DbExecutor, episodeId: string): Promise<void> {
  await db.query('SELECT id FROM promptoon_episode WHERE id = $1 FOR UPDATE', [episodeId]);
}
