import type {
  Choice,
  ChoiceStateWrite,
  Cut,
  CutContentBlock,
  CutStateRoute,
  CutStateVariant,
  Episode,
  ExitLoopEpisodeMetadata,
  Project,
  ProjectAssetListResponse,
  ProjectAssetSummary,
  ProjectPublishHistoryItem,
  ProjectPublishHistoryResponse,
  ProjectWithEpisodes,
  PromptoonBackupChoice,
  PromptoonBackupProject,
  PromptoonBackupViewerEvent,
  PromptoonEpisodeMode,
  Publish,
  PublishManifest,
  TelemetryEventType
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

interface ProjectPublishHistoryRow {
  publish_id: string;
  episode_id: string;
  episode_title: string;
  episode_no: number;
  version_no: number;
  status: 'published';
  created_at: Date;
  channel_id: string | null;
  series_id: string | null;
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

interface ChoiceBackupRow extends ChoiceRow {
  episode_id: string;
}

interface PublishRow {
  id: string;
  project_id: string;
  episode_id: string;
  version_no: number;
  status: 'published';
  manifest: PublishManifest;
  created_by: string;
  created_at: Date;
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
     ORDER BY project.updated_at DESC`,
    values
  );

  return result.rows.map((row) => ({
    ...mapProject(row),
    episodes: row.episodes
  }));
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

export async function getProjectById(db: DbExecutor, projectId: string): Promise<Project | null> {
  const result = await db.query<ProjectRow>('SELECT * FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0] ? mapProject(result.rows[0]) : null;
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
