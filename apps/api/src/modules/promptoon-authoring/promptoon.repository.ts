import type {
  AnalyticsChoiceStat,
  AnalyticsCutEngagement,
  AnalyticsDailyView,
  AnalyticsEndingStat,
  Choice,
  Cut,
  CutContentBlock,
  Episode,
  EpisodeDraftResponse,
  Project,
  ProjectWithEpisodes,
  Publish,
  PublishManifest,
  ReorderEpisodeCutsRequest,
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

interface EpisodeRow {
  id: string;
  project_id: string;
  title: string;
  episode_no: number;
  cover_image_url: string | null;
  start_cut_id: string | null;
  status: 'draft' | 'published';
  created_at: Date;
  updated_at: Date;
}

interface CutRow {
  id: string;
  episode_id: string;
  kind: 'scene' | 'choice' | 'ending' | 'transition';
  title: string;
  body: string;
  content_blocks: CutContentBlock[] | null;
  content_view_mode: Cut['contentViewMode'] | null;
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
  created_at: Date;
  updated_at: Date;
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

interface ViewerEventInsertRow {
  id: string;
}

interface ViewerEventCountRow {
  count: string;
}

interface DailyViewsRow {
  date: string;
  views: string;
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

export async function listProjects(db: DbExecutor): Promise<Project[]> {
  const result = await db.query<ProjectRow>('SELECT * FROM promptoon_project ORDER BY updated_at DESC');
  return result.rows.map(mapProject);
}

export async function listProjectsWithEpisodes(db: DbExecutor, ownerId?: string): Promise<ProjectWithEpisodes[]> {
  const values: unknown[] = [];
  const ownerFilter = ownerId
    ? (() => {
        values.push(ownerId);
        return `WHERE project.created_by = $${values.length}`;
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
     ${ownerFilter}
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

export async function getProjectOwnerId(db: DbExecutor, projectId: string): Promise<string | null> {
  const result = await db.query<{ created_by: string }>('SELECT created_by FROM promptoon_project WHERE id = $1', [projectId]);
  return result.rows[0]?.created_by ?? null;
}

export async function createEpisode(
  db: DbExecutor,
  input: { projectId: string; title: string; episodeNo: number; coverImageUrl?: string | null }
): Promise<Episode> {
  const result = await db.query<EpisodeRow>(
    `INSERT INTO promptoon_episode (id, project_id, title, episode_no, cover_image_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [randomUUID(), input.projectId, input.title, input.episodeNo, input.coverImageUrl ?? null]
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
  }>
): Promise<Episode | null> {
  const existing = await getEpisodeById(db, episodeId);
  if (!existing) {
    return null;
  }

  const nextCoverImageUrl = Object.prototype.hasOwnProperty.call(patch, 'coverImageUrl')
    ? patch.coverImageUrl ?? null
    : existing.coverImageUrl;
  const result = await db.query<EpisodeRow>(
    `UPDATE promptoon_episode
     SET title = $1,
         cover_image_url = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [patch.title ?? existing.title, nextCoverImageUrl, episodeId]
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

export async function createCut(
  db: DbExecutor,
  input: {
    episodeId: string;
    kind: Cut['kind'];
    title: string;
    body?: string;
    contentBlocks?: CutContentBlock[];
    contentViewMode?: Cut['contentViewMode'];
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
      id, episode_id, kind, title, body, content_blocks, content_view_mode, dialog_anchor_x, dialog_anchor_y, dialog_offset_x, dialog_offset_y, dialog_text_align,
      start_effect, end_effect, start_effect_duration_ms, end_effect_duration_ms, asset_url, edge_fade, edge_fade_intensity, edge_fade_color, margin_bottom_token, position_x, position_y, order_index, is_start, is_ending
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
     RETURNING *`,
    [
      randomUUID(),
      input.episodeId,
      input.kind,
      input.title,
      input.body ?? '',
      JSON.stringify(input.contentBlocks ?? []),
      input.contentViewMode ?? 'default',
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
      input.isEnding ?? input.kind === 'ending'
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
  const nextIsEnding =
    patch.isEnding !== undefined ? patch.isEnding : patch.kind === 'ending' ? true : existing.isEnding;
  const result = await db.query<CutRow>(
    `UPDATE promptoon_cut
     SET kind = $1,
         title = $2,
         body = $3,
         content_blocks = $4::jsonb,
         content_view_mode = $5,
         dialog_anchor_x = $6,
         dialog_anchor_y = $7,
         dialog_offset_x = $8,
         dialog_offset_y = $9,
         dialog_text_align = $10,
         start_effect = $11,
         end_effect = $12,
         start_effect_duration_ms = $13,
         end_effect_duration_ms = $14,
         asset_url = $15,
         edge_fade = $16,
         edge_fade_intensity = $17,
         edge_fade_color = $18,
         margin_bottom_token = $19,
         position_x = $20,
         position_y = $21,
         order_index = $22,
         is_start = $23,
         is_ending = $24,
         updated_at = NOW()
     WHERE id = $25
     RETURNING *`,
    [
      patch.kind ?? existing.kind,
      patch.title ?? existing.title,
      patch.body ?? existing.body,
      JSON.stringify(patch.contentBlocks ?? existing.contentBlocks),
      patch.contentViewMode ?? existing.contentViewMode ?? 'default',
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

export async function createChoice(
  db: DbExecutor,
  input: {
    cutId: string;
    label: string;
    orderIndex?: number;
    nextCutId?: string | null;
    afterSelectReactionText?: string;
  }
): Promise<Choice> {
  const countResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_choice WHERE cut_id = $1', [
    input.cutId
  ]);
  const defaultOrderIndex = Number(countResult.rows[0].count);
  const result = await db.query<ChoiceRow>(
    `INSERT INTO promptoon_choice (id, cut_id, label, order_index, next_cut_id, after_select_reaction_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      randomUUID(),
      input.cutId,
      input.label,
      input.orderIndex ?? defaultOrderIndex,
      input.nextCutId ?? null,
      input.afterSelectReactionText?.trim() ? input.afterSelectReactionText : null
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
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [patch.label ?? existing.label, patch.orderIndex ?? existing.orderIndex, nextCutId, nextReactionText, choiceId]
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
  }
): Promise<void> {
  await db.query<ViewerEventInsertRow>(
    `INSERT INTO promptoon_viewer_event (id, publish_id, episode_id, anonymous_id, session_id, event_type, cut_id, choice_id, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      randomUUID(),
      input.publishId,
      input.episodeId,
      input.anonymousId,
      input.sessionId,
      input.eventType,
      input.cutId,
      input.choiceId ?? null,
      input.durationMs ?? null
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

export async function getDailyStartViews(
  db: DbExecutor,
  input: { episodeId: string; startCutId: string; days: number }
): Promise<AnalyticsDailyView[]> {
  const result = await db.query<DailyViewsRow>(
    `SELECT
       TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS date,
       COUNT(*)::text AS views
     FROM promptoon_viewer_event
     WHERE episode_id = $1
       AND event_type = 'cut_view'
       AND cut_id = $2
       AND created_at >= NOW() - ($3::text || ' days')::interval
     GROUP BY DATE_TRUNC('day', created_at)
     ORDER BY DATE_TRUNC('day', created_at) ASC`,
    [input.episodeId, input.startCutId, input.days]
  );

  return result.rows.map((row) => ({
    date: row.date,
    views: Number(row.views)
  }));
}

export async function createPublish(
  db: DbExecutor,
  input: {
    projectId: string;
    episodeId: string;
    versionNo: number;
    manifest: PublishManifest;
    createdBy: string;
  }
): Promise<Publish> {
  const result = await db.query<PublishRow>(
    `INSERT INTO promptoon_publish (id, project_id, episode_id, version_no, status, manifest, created_by)
     VALUES ($1, $2, $3, $4, 'published', $5, $6)
     RETURNING *`,
    [randomUUID(), input.projectId, input.episodeId, input.versionNo, JSON.stringify(input.manifest), input.createdBy]
  );

  return mapPublish(result.rows[0]);
}

export async function updateLatestPublishForEpisode(
  db: DbExecutor,
  input: {
    projectId: string;
    episodeId: string;
    manifest: PublishManifest;
    createdBy: string;
  }
): Promise<Publish | null> {
  const result = await db.query<PublishRow>(
    `UPDATE promptoon_publish
     SET manifest = $3,
         created_by = $4,
         created_at = NOW()
     WHERE id = (
       SELECT id
       FROM promptoon_publish
       WHERE project_id = $1
         AND episode_id = $2
       ORDER BY version_no DESC, created_at DESC, id DESC
       LIMIT 1
     )
     RETURNING *`,
    [input.projectId, input.episodeId, JSON.stringify(input.manifest), input.createdBy]
  );

  return result.rows[0] ? mapPublish(result.rows[0]) : null;
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
     )::boolean AS exists`,
    [projectId]
  );

  return Boolean(result.rows[0]?.exists);
}

export async function lockEpisodeForPublish(db: DbExecutor, episodeId: string): Promise<void> {
  await db.query('SELECT id FROM promptoon_episode WHERE id = $1 FOR UPDATE', [episodeId]);
}
