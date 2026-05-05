import type {
  Choice,
  ChoiceStateWrite,
  Cut,
  CutContentBlock,
  CutStateRoute,
  CutStateVariant,
  Episode,
  EpisodeDraftResponse,
  ExitLoopEpisodeMetadata,
  PatchEpisodeCutLayoutRequest,
  PromptoonEpisodeMode,
  Publish,
  PublishManifest,
  ReorderEpisodeCutsRequest
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

type EpisodeRow = {
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
};

type CutRow = {
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
  dialog_text_align: Cut['dialogTextAlign'];
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
};

type ChoiceRow = {
  id: string;
  cut_id: string;
  label: string;
  order_index: number;
  next_cut_id: string | null;
  after_select_reaction_text: string | null;
  state_writes: ChoiceStateWrite[] | null;
  created_at: Date;
  updated_at: Date;
};

type PublishRow = {
  id: string;
  project_id: string;
  episode_id: string;
  version_no: number;
  status: 'published';
  manifest: PublishManifest;
  created_by: string;
  created_at: Date;
};

function toIsoString(value: Date): string {
  return value.toISOString();
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

export async function getChoiceById(db: DbExecutor, choiceId: string): Promise<Choice | null> {
  const result = await db.query<ChoiceRow>('SELECT * FROM promptoon_choice WHERE id = $1', [choiceId]);
  return result.rows[0] ? mapChoice(result.rows[0]) : null;
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
