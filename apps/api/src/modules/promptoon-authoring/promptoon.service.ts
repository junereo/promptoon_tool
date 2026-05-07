import type {
  AssetUploadResponse,
  AnalyticsChoiceStat,
  AnalyticsEpisodeResponse,
  AnalyticsViewRange,
  AnalyticsViewGranularity,
  AnalyticsViewPoint,
  ChannelSubscriptionStateResponse,
  ChannelHome,
  CommentsMetaResponse,
  Choice,
  ChoiceStateWrite,
  ContentInteractionStateListResponse,
  CutContentBlock,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateLoopStateSettingRequest,
  CreateLoopStateSettingResponse,
  CutStateVariant,
  CutStateRoute,
  DeleteCutRequest,
  CreateEpisodeRequest,
  CreateProjectRequest,
  Cut,
  Episode,
  EpisodeDraftResponse,
  FeedItem,
  FeedResponse,
  PatchEpisodeRequest,
  PatchEpisodeCutLayoutRequest,
  PatchEpisodeCutLayoutResponse,
  PatchChoiceRequest,
  PatchCutRequest,
  Project,
  ProjectMemberListResponse,
  ProjectRole,
  ProjectWithEpisodes,
  PatchProjectMemberRequest,
  PromptoonBackupExport,
  Publish,
  PublishManifest,
  PublishRequest,
  RebuildPublicProjectionsResponse,
  RelatedShort,
  ReorderEpisodeCutsRequest,
  ReorderEpisodeCutsResponse,
  ResetEpisodeAnalyticsRequest,
  TelemetryEventPayload,
  TelemetryEventRequest,
  UpsertProjectMemberRequest,
  ValidateEpisodeResponse,
  ViewerInteractionStateResponse
} from '@promptoon/shared';
import {
  createHash,
  randomUUID
} from 'node:crypto';
import {
  DEFAULT_CONTENT_SPACING,
  DEFAULT_CONTENT_VIEW_MODE,
  DEFAULT_CUT_EFFECT_DURATION_MS,
  DEFAULT_EDGE_FADE,
  DEFAULT_EDGE_FADE_COLOR,
  DEFAULT_EDGE_FADE_INTENSITY,
  MAX_CUT_STATE_ROUTE_CONDITIONS,
  deriveCutBody,
  getCutStateRouteConditions,
  getNormalizedCutContentBlocks
} from '@promptoon/shared';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import sharp from 'sharp';

import { db, withTransaction, type DbExecutor } from '../../db';
import { HttpError } from '../../lib/http-error';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../../lib/workspace-paths';
import * as coreProjectionService from '../promptoon-core/projection.service';
import * as repository from './promptoon.repository';
import { validateEpisodeGraph } from './promptoon.validators';

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function assertPublicPublish(value: Publish | null, message: string): Publish {
  const publish = assertExists(value, message);
  if (publish.status !== 'published') {
    throw new HttpError(404, message);
  }

  return publish;
}

interface SharePageMeta {
  title: string;
  description: string;
  imageUrl: string | null;
  redirectUrl: string;
  shareUrl: string;
}

interface SharePageOptions {
  sharePath?: string;
}

interface FeedCursorPayload {
  createdAt: string;
  publishId: string;
}

interface ProjectionChannelInput {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
}

interface ProjectionSeriesInput {
  id: string;
}

const PROJECT_READ_ROLES: ProjectRole[] = ['owner', 'producer', 'writer', 'viewer'];
const PROJECT_WRITE_ROLES: ProjectRole[] = ['owner', 'producer', 'writer'];
const PROJECT_PUBLISH_ROLES: ProjectRole[] = ['owner', 'producer'];
const PROJECT_OWNER_ROLES: ProjectRole[] = ['owner'];

function normalizeCutEffectDurationMs(value: number | undefined): number {
  return value ?? DEFAULT_CUT_EFFECT_DURATION_MS;
}

function normalizeManifestContentBlocks(cut: { id: string; body: string; contentBlocks?: CutContentBlock[] }): CutContentBlock[] {
  return getNormalizedCutContentBlocks({
    id: cut.id,
    body: cut.body,
    contentBlocks: cut.contentBlocks ?? []
  });
}

function normalizeManifest(manifest: PublishManifest): PublishManifest {
  return {
    ...manifest,
    episode: {
      ...manifest.episode,
      coverImageUrl: manifest.episode.coverImageUrl ?? null
    },
    cuts: manifest.cuts.map((cut) => {
      const contentBlocks = normalizeManifestContentBlocks(cut);

      return {
        ...cut,
        body: deriveCutBody(contentBlocks, cut.body),
        contentBlocks,
        contentViewMode: cut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
        edgeFade: cut.edgeFade ?? DEFAULT_EDGE_FADE,
        edgeFadeIntensity: cut.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
        edgeFadeColor: cut.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
        marginBottomToken: cut.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
        stateVariants: cut.stateVariants ?? [],
        stateRoutes: cut.stateRoutes ?? [],
        stateFallbackCutId: cut.stateFallbackCutId ?? null,
        loopMetadata: cut.loopMetadata ?? null,
        startEffect: cut.startEffect ?? 'none',
        endEffect: cut.endEffect ?? 'none',
        startEffectDurationMs: normalizeCutEffectDurationMs(cut.startEffectDurationMs),
        endEffectDurationMs: normalizeCutEffectDurationMs(cut.endEffectDurationMs),
        choices: cut.choices.map((choice) => ({
          ...choice,
          afterSelectReactionText: choice.afterSelectReactionText ?? undefined,
          stateWrites: choice.stateWrites ?? []
        }))
      };
    })
  };
}

function normalizePublish(publish: Publish): Publish {
  return {
    ...publish,
    manifest: normalizeManifest(publish.manifest)
  };
}

async function ensureProjectExists(projectId: string): Promise<Project> {
  return assertExists(await repository.getProjectById(db, projectId), 'Project not found.');
}

async function ensureEpisodeExists(episodeId: string): Promise<Episode> {
  return assertExists(await repository.getEpisodeById(db, episodeId), 'Episode not found.');
}

async function ensureEpisodeBelongsToProject(projectId: string, episodeId: string): Promise<Episode> {
  const episode = await ensureEpisodeExists(episodeId);
  if (episode.projectId !== projectId) {
    throw new HttpError(404, 'Episode not found in project.');
  }

  return episode;
}

async function ensureProjectRole(projectId: string, userId: string, allowedRoles: ProjectRole[]): Promise<ProjectRole> {
  const ownerId = await repository.getProjectOwnerId(db, projectId);
  if (!ownerId) {
    throw new HttpError(404, 'Project not found.');
  }

  let role = await repository.getProjectMemberRole(db, {
    projectId,
    userId
  });

  if (!role && ownerId === userId) {
    role = 'owner';
    await repository.upsertProjectMember(db, {
      projectId,
      userId,
      role
    });
  }

  if (!role || !allowedRoles.includes(role)) {
    throw new HttpError(403, 'You do not have access to this project.');
  }

  return role;
}

async function ensureProjectOwnedByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_OWNER_ROLES);
}

async function ensureProjectReadableByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_READ_ROLES);
}

async function ensureProjectWritableByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_WRITE_ROLES);
}

async function ensureProjectPublishableByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_PUBLISH_ROLES);
}

async function ensureStudioAdmin(userId: string): Promise<void> {
  const role = await repository.getStudioMemberRole(db, userId);
  if (role !== 'studio_admin') {
    throw new HttpError(403, 'Studio admin role is required.');
  }
}

async function ensureEpisodeProjectRole(episodeId: string, userId: string, allowedRoles: ProjectRole[]): Promise<void> {
  const projectId = await repository.getEpisodeProjectId(db, episodeId);
  if (!projectId) {
    throw new HttpError(404, 'Episode not found.');
  }

  await ensureProjectRole(projectId, userId, allowedRoles);
}

async function ensureCutProjectRole(cutId: string, userId: string, allowedRoles: ProjectRole[]): Promise<void> {
  const projectId = await repository.getCutProjectId(db, cutId);
  if (!projectId) {
    throw new HttpError(404, 'Cut not found.');
  }

  await ensureProjectRole(projectId, userId, allowedRoles);
}

async function ensureChoiceProjectRole(choiceId: string, userId: string, allowedRoles: ProjectRole[]): Promise<void> {
  const projectId = await repository.getChoiceProjectId(db, choiceId);
  if (!projectId) {
    throw new HttpError(404, 'Choice not found.');
  }

  await ensureProjectRole(projectId, userId, allowedRoles);
}

async function ensureEpisodeOwnedByUser(episodeId: string, userId: string): Promise<void> {
  await ensureEpisodeProjectRole(episodeId, userId, PROJECT_WRITE_ROLES);
}

async function ensureCutOwnedByUser(cutId: string, userId: string): Promise<void> {
  await ensureCutProjectRole(cutId, userId, PROJECT_WRITE_ROLES);
}

function getBackupTotals(projects: PromptoonBackupExport['projects']): PromptoonBackupExport['totals'] {
  return projects.reduce(
    (totals, projectBackup) => {
      totals.projects += 1;
      totals.episodes += projectBackup.episodes.length;

      for (const episodeBackup of projectBackup.episodes) {
        totals.cuts += episodeBackup.cuts.length;
        totals.choices += episodeBackup.choices.length;
        totals.publishes += episodeBackup.publishes.length;
        totals.viewerEvents += episodeBackup.viewerEvents.length;
      }

      return totals;
    },
    {
      projects: 0,
      episodes: 0,
      cuts: 0,
      choices: 0,
      publishes: 0,
      viewerEvents: 0
    }
  );
}

async function ensureChoiceOwnedByUser(choiceId: string, userId: string): Promise<void> {
  await ensureChoiceProjectRole(choiceId, userId, PROJECT_WRITE_ROLES);
}

function normalizeChoiceStateWrites(stateWrites: ChoiceStateWrite[] | undefined): ChoiceStateWrite[] | undefined {
  if (!stateWrites) {
    return undefined;
  }

  return stateWrites.map((stateWrite) => ({
    key: stateWrite.key.trim(),
    value: stateWrite.value.trim(),
    operation: stateWrite.operation ?? 'set'
  }));
}

function normalizeCutStateVariants(stateVariants: CutStateVariant[] | undefined): CutStateVariant[] | undefined {
  if (!stateVariants) {
    return undefined;
  }

  return stateVariants.map((stateVariant) => ({
    id: stateVariant.id.trim(),
    stateKey: stateVariant.stateKey.trim(),
    equals: stateVariant.equals.trim(),
    variantCutId: stateVariant.variantCutId,
    label: stateVariant.label?.trim() || undefined
  }));
}

function normalizeCutStateRoutes(stateRoutes: CutStateRoute[] | undefined): CutStateRoute[] | undefined {
  if (!stateRoutes) {
    return undefined;
  }

  return stateRoutes.map((stateRoute) => {
    const conditions = getCutStateRouteConditions(stateRoute).slice(0, MAX_CUT_STATE_ROUTE_CONDITIONS);
    const firstCondition = conditions[0] ?? { stateKey: '', equals: '' };

    return {
      id: stateRoute.id.trim(),
      stateKey: firstCondition.stateKey,
      equals: firstCondition.equals,
      conditions,
      nextCutId: stateRoute.nextCutId,
      label: stateRoute.label?.trim() || undefined
    };
  });
}

function normalizeCutLoopMetadata(loopMetadata: Cut['loopMetadata'] | undefined): Cut['loopMetadata'] | undefined {
  if (loopMetadata === undefined) {
    return undefined;
  }

  if (!loopMetadata) {
    return null;
  }

  return {
    kind: 'exitLoop',
    groupId: loopMetadata.groupId.trim(),
    groupLabel: loopMetadata.groupLabel?.trim() || undefined,
    role: loopMetadata.role,
    stageIndex: loopMetadata.stageIndex,
    stageCount: loopMetadata.stageCount,
    truth: loopMetadata.truth,
    expectedChoice: loopMetadata.expectedChoice,
    baseCutId: loopMetadata.baseCutId ?? null,
    selectedVariantCutId: loopMetadata.selectedVariantCutId ?? null,
    variantCutIds: loopMetadata.variantCutIds?.filter((cutId, index, cutIds) => cutIds.indexOf(cutId) === index),
    exitLevelRequired: loopMetadata.exitLevelRequired,
    resetStateOnEnter: loopMetadata.resetStateOnEnter,
    resetStateKeyPrefix: loopMetadata.resetStateKeyPrefix?.trim() || undefined
  };
}

function assertLoopCutKindMatchesMetadata(kind: Cut['kind'], loopMetadata: Cut['loopMetadata'] | null | undefined): void {
  const expectedRoleByKind: Partial<Record<Cut['kind'], NonNullable<Cut['loopMetadata']>['role']>> = {
    loopStage: 'stageBase',
    loopVariant: 'stageVariant',
    loopSpacer: 'spacer',
    stateRouter: 'resultRouter'
  };
  const expectedRole = expectedRoleByKind[kind];

  if (kind === 'loopStage' || kind === 'loopVariant' || kind === 'loopSpacer') {
    if (!loopMetadata || loopMetadata.kind !== 'exitLoop') {
      throw new HttpError(400, 'Loop cut kinds must be created through LoopStateSetting.');
    }
  }

  if (!loopMetadata) {
    return;
  }

  if (loopMetadata.kind !== 'exitLoop') {
    throw new HttpError(400, 'Invalid loop metadata.');
  }

  if (!expectedRole || loopMetadata.role !== expectedRole) {
    throw new HttpError(400, 'Loop metadata role does not match the cut kind.');
  }
}

async function ensureStateVariantTargetsInEpisode(input: {
  episodeId: string;
  sourceCutId?: string;
  stateVariants?: CutStateVariant[];
}): Promise<void> {
  if (!input.stateVariants || input.stateVariants.length === 0) {
    return;
  }

  const draft = assertExists(await repository.getEpisodeDraft(db, input.episodeId), 'Episode not found.');
  const cutIds = new Set(draft.cuts.map((cut) => cut.id));

  for (const stateVariant of input.stateVariants) {
    if (stateVariant.variantCutId === input.sourceCutId) {
      throw new HttpError(400, 'State variant target cannot be the source cut.');
    }

    if (!cutIds.has(stateVariant.variantCutId)) {
      throw new HttpError(400, 'State variant target must reference a cut in the same episode.');
    }
  }
}

async function ensureStateRouterTargetsInEpisode(input: {
  episodeId: string;
  sourceCutId?: string;
  stateRoutes?: CutStateRoute[];
  stateFallbackCutId?: string | null;
}): Promise<void> {
  if ((!input.stateRoutes || input.stateRoutes.length === 0) && !input.stateFallbackCutId) {
    return;
  }

  const draft = assertExists(await repository.getEpisodeDraft(db, input.episodeId), 'Episode not found.');
  const cutIds = new Set(draft.cuts.map((cut) => cut.id));
  const targetIds = [
    ...(input.stateRoutes ?? []).map((stateRoute) => stateRoute.nextCutId),
    ...(input.stateFallbackCutId ? [input.stateFallbackCutId] : [])
  ];

  for (const targetId of targetIds) {
    if (targetId === input.sourceCutId) {
      throw new HttpError(400, 'State router target cannot be the source cut.');
    }

    if (!cutIds.has(targetId)) {
      throw new HttpError(400, 'State router target must reference a cut in the same episode.');
    }
  }
}

async function ensureLoopMetadataTargetsInEpisode(input: {
  episodeId: string;
  sourceCutId?: string;
  loopMetadata?: Cut['loopMetadata'] | null;
}): Promise<void> {
  if (!input.loopMetadata) {
    return;
  }

  const targetIds = [
    input.loopMetadata.baseCutId ?? null,
    input.loopMetadata.selectedVariantCutId ?? null,
    ...(input.loopMetadata.variantCutIds ?? [])
  ].filter((targetId): targetId is string => Boolean(targetId));
  if (targetIds.length === 0) {
    return;
  }

  const draft = assertExists(await repository.getEpisodeDraft(db, input.episodeId), 'Episode not found.');
  const cutIds = new Set(draft.cuts.map((cut) => cut.id));

  for (const targetId of targetIds) {
    if (targetId === input.sourceCutId) {
      throw new HttpError(400, 'Loop metadata target cannot be the source cut.');
    }

    if (!cutIds.has(targetId)) {
      throw new HttpError(400, 'Loop metadata target must reference a cut in the same episode.');
    }
  }
}

function buildManifest(draft: EpisodeDraftResponse, project: Project): PublishManifest {
  const choicesByCutId = new Map<string, Choice[]>();
  for (const choice of draft.choices) {
    const list = choicesByCutId.get(choice.cutId) ?? [];
    list.push(choice);
    choicesByCutId.set(choice.cutId, list);
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      thumbnailUrl: project.thumbnailUrl,
      status: project.status
    },
    episode: {
      id: draft.episode.id,
      title: draft.episode.title,
      episodeNo: draft.episode.episodeNo,
      coverImageUrl: draft.episode.coverImageUrl,
      status: draft.episode.status,
      startCutId: draft.episode.startCutId,
      mode: draft.episode.mode,
      exitLoopMetadata: draft.episode.exitLoopMetadata
    },
    cuts: draft.cuts.map((cut) => ({
      contentBlocks: getNormalizedCutContentBlocks(cut),
      id: cut.id,
      kind: cut.kind,
      title: cut.title,
      body: deriveCutBody(getNormalizedCutContentBlocks(cut), cut.body),
      contentViewMode: cut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
      edgeFade: cut.edgeFade ?? DEFAULT_EDGE_FADE,
      edgeFadeIntensity: cut.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
      edgeFadeColor: cut.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
      marginBottomToken: cut.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
      dialogAnchorX: cut.dialogAnchorX,
      dialogAnchorY: cut.dialogAnchorY,
      dialogOffsetX: cut.dialogOffsetX,
      dialogOffsetY: cut.dialogOffsetY,
      dialogTextAlign: cut.dialogTextAlign,
      startEffect: cut.startEffect ?? 'none',
      endEffect: cut.endEffect ?? 'none',
      startEffectDurationMs: normalizeCutEffectDurationMs(cut.startEffectDurationMs),
      endEffectDurationMs: normalizeCutEffectDurationMs(cut.endEffectDurationMs),
      assetUrl: cut.assetUrl,
      positionX: cut.positionX,
      positionY: cut.positionY,
      orderIndex: cut.orderIndex,
      isStart: cut.isStart,
      isEnding: cut.isEnding,
      stateVariants: cut.stateVariants ?? [],
      stateRoutes: cut.stateRoutes ?? [],
      stateFallbackCutId: cut.stateFallbackCutId ?? null,
      loopMetadata: cut.loopMetadata ?? null,
      choices: (choicesByCutId.get(cut.id) ?? []).map((choice) => ({
        id: choice.id,
        label: choice.label,
        orderIndex: choice.orderIndex,
        nextCutId: choice.nextCutId,
        afterSelectReactionText: choice.afterSelectReactionText,
        stateWrites: choice.stateWrites ?? []
      }))
    }))
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function getUploadsDirectory(): string {
  return resolveFromWorkspaceRoot('.data/uploads');
}

function getLegacyUploadsDirectory(): string {
  return resolveFromApiRoot('.data/uploads');
}

function isWritablePathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'EROFS'].includes(String(error.code));
}

interface UploadFileWrite {
  fileName: string;
  buffer: Buffer;
}

async function writeUploadFiles(relativeDirectory: string, files: UploadFileWrite[]): Promise<void> {
  const directoryCandidates = [path.join(getUploadsDirectory(), relativeDirectory), path.join(getLegacyUploadsDirectory(), relativeDirectory)];
  let lastError: unknown = null;

  for (const uploadsDirectory of directoryCandidates) {
    try {
      await mkdir(uploadsDirectory, { recursive: true });
      for (const file of files) {
        await writeFile(path.join(uploadsDirectory, file.fileName), file.buffer);
      }

      return;
    } catch (error) {
      lastError = error;
      if (!isWritablePathError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function sanitizeUploadBaseName(fileName: string): string {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension).trim();
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return sanitized || 'image';
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function getDatedUploadSegments(now: Date): [string, string, string] {
  return [String(now.getFullYear()), padDatePart(now.getMonth() + 1), padDatePart(now.getDate())];
}

function buildProjectUploadBaseName(file: Express.Multer.File, now: Date): string {
  return `${sanitizeUploadBaseName(file.originalname)}-${now.getTime()}`;
}

function buildOriginalUploadFileName(file: Express.Multer.File, uploadBaseName: string): string {
  const extension = getUploadExtension(file);
  const originalSuffix = extension === '.webp' ? '-original' : '';

  return `${uploadBaseName}${originalSuffix}${extension}`;
}

function buildWebpUploadFileName(uploadBaseName: string): string {
  return `${uploadBaseName}.webp`;
}

function buildPublicUploadScope(): string {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

function buildAssetUrl(publicUploadScope: string, fileName: string, now: Date): string {
  return path.posix.join('/uploads', ...getDatedUploadSegments(now), publicUploadScope, fileName);
}

function getUploadExtension(file: Express.Multer.File): string {
  const originalExtension = path.extname(file.originalname).toLowerCase();
  if (originalExtension) {
    return originalExtension;
  }

  const mimeSubtype = file.mimetype.split('/')[1]?.toLowerCase();
  if (!mimeSubtype) {
    return '.bin';
  }

  if (mimeSubtype === 'jpeg') {
    return '.jpg';
  }

  return `.${mimeSubtype.replace(/[^a-z0-9]/g, '') || 'bin'}`;
}

async function convertUploadToWebp(file: Express.Multer.File): Promise<Buffer> {
  try {
    return await sharp(file.buffer).webp().toBuffer();
  } catch {
    throw new HttpError(400, 'Invalid image file.');
  }
}

function toAbsoluteUrl(baseOrigin: string, value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalizedOrigin = trimTrailingSlash(baseOrigin);
  if (value.startsWith('/')) {
    return `${normalizedOrigin}${value}`;
  }

  return `${normalizedOrigin}/${value}`;
}

function toPublicProjectRef(projectId: string): string {
  return `prj_${createHash('sha256').update(projectId).digest('base64url').slice(0, 10)}`;
}

function toPublicPublish(publish: Publish): Publish {
  const publicProjectRef = toPublicProjectRef(publish.projectId);

  return {
    ...publish,
    projectId: publicProjectRef,
    manifest: {
      ...publish.manifest,
      project: {
        ...publish.manifest.project,
        id: publicProjectRef
      }
    }
  };
}

function summarizeDescription(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function isEndingLikeCut(cut: { isEnding?: boolean; kind: string }): boolean {
  return Boolean(cut.isEnding) || cut.kind === 'ending' || cut.kind === 'resultCard';
}

function getShareImageUrl(publish: Publish, endingCutId: string | undefined, baseOrigin: string): string | null {
  const manifest = publish.manifest;
  const endingCut =
    endingCutId
      ? manifest.cuts.find((cut) => cut.id === endingCutId && isEndingLikeCut(cut)) ?? null
      : null;
  const fallbackCutWithImage = manifest.cuts.find((cut) => Boolean(cut.assetUrl)) ?? null;

  return (
    toAbsoluteUrl(baseOrigin, endingCut?.assetUrl) ??
    toAbsoluteUrl(baseOrigin, manifest.episode.coverImageUrl) ??
    toAbsoluteUrl(baseOrigin, fallbackCutWithImage?.assetUrl) ??
    toAbsoluteUrl(baseOrigin, manifest.project.thumbnailUrl)
  );
}

function buildSharePageMeta(
  publish: Publish,
  endingCutId: string | undefined,
  baseOrigin: string,
  options: SharePageOptions = {}
): SharePageMeta {
  const manifest = publish.manifest;
  const validEndingCut =
    endingCutId
      ? manifest.cuts.find((cut) => cut.id === endingCutId && isEndingLikeCut(cut)) ?? null
      : null;
  const querySuffix = validEndingCut ? `?e=${encodeURIComponent(validEndingCut.id)}` : '';
  const redirectUrl = `${trimTrailingSlash(baseOrigin)}/v/${publish.id}${querySuffix}`;
  const sharePath = options.sharePath ?? `/api/promptoon/share/${publish.id}`;
  const normalizedSharePath = sharePath.startsWith('/') ? sharePath : `/${sharePath}`;
  const shareUrl = `${trimTrailingSlash(baseOrigin)}${normalizedSharePath}${querySuffix}`;
  const title = validEndingCut
    ? `${manifest.episode.title} - 나는 "${validEndingCut.title}" 엔딩을 봤어!`
    : `${manifest.episode.title} - 인터랙티브 웹툰`;
  const description = summarizeDescription(
    deriveCutBody(validEndingCut?.contentBlocks ?? [], validEndingCut?.body ?? manifest.project.description ?? '') || manifest.project.description,
    validEndingCut
      ? `${validEndingCut.title} 엔딩을 확인해보세요. 당신은 어떤 결말에 도달할까요?`
      : `${manifest.episode.title}의 분기 엔딩을 확인해보세요.`
  );

  return {
    title,
    description,
    imageUrl: getShareImageUrl(publish, validEndingCut?.id, baseOrigin),
    redirectUrl,
    shareUrl
  };
}

async function getBaseShareTemplate(): Promise<string> {
  try {
    return await readFile(resolveFromWorkspaceRoot('apps/web/index.html'), 'utf8');
  } catch {
    return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Promptoon</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
  }
}

function buildShareBody(meta: SharePageMeta): string {
  return `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#050506;color:#f4f4f5;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;text-align:center;">
        <p style="margin:0 0 12px;color:#a1a1aa;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Promptoon Share</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">${escapeHtml(meta.title)}</h1>
        <p style="margin:0 0 22px;color:#d4d4d8;line-height:1.6;">${escapeHtml(meta.description)}</p>
        <p style="margin:0;color:#71717a;font-size:14px;">잠시 후 뷰어로 이동합니다.</p>
        <p style="margin:18px 0 0;"><a href="${escapeHtml(meta.redirectUrl)}" style="color:#f4f4f5;">계속하려면 여기를 클릭하세요</a></p>
      </div>
    </main>
    <script>
      window.location.replace(${JSON.stringify(meta.redirectUrl)});
    </script>
  `;
}

function injectShareTemplate(template: string, meta: SharePageMeta): string {
  const escapedTitle = escapeHtml(meta.title);
  const escapedDescription = escapeHtml(meta.description);
  const imageTags = meta.imageUrl
    ? `
    <meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />
    <meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`
    : '';
  const headTags = `
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapeHtml(meta.shareUrl)}" />${imageTags}
    <meta name="twitter:card" content="${meta.imageUrl ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />`;
  const bodyContent = buildShareBody(meta);
  const withTitle = template.includes('</title>')
    ? template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
    : template.replace('</head>', `  <title>${escapedTitle}</title>\n</head>`);
  const withHead = withTitle.includes('</head>') ? withTitle.replace('</head>', `${headTags}\n  </head>`) : withTitle;

  return withHead.match(/<body([^>]*)>[\s\S]*<\/body>/i)
    ? withHead.replace(/<body([^>]*)>[\s\S]*<\/body>/i, `<body$1>${bodyContent}</body>`)
    : `${withHead}\n<body>${bodyContent}</body>`;
}

function getStartCutId(draft: EpisodeDraftResponse): string | null {
  return draft.episode.startCutId ?? draft.cuts.find((cut) => cut.isStart)?.id ?? draft.cuts[0]?.id ?? null;
}

function getUtcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getUtcIsoWeekStart(date: Date): Date {
  const start = getUtcStartOfDay(date);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseAnalyticsDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function getUtcPeriodStart(date: Date, granularity: AnalyticsViewGranularity): Date {
  if (granularity === 'weekly') {
    return getUtcIsoWeekStart(date);
  }

  if (granularity === 'monthly') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  return getUtcStartOfDay(date);
}

function addAnalyticsPeriod(date: Date, granularity: AnalyticsViewGranularity, amount: number): Date {
  const result = new Date(date.getTime());

  if (granularity === 'monthly') {
    result.setUTCMonth(result.getUTCMonth() + amount, 1);
  } else {
    result.setUTCDate(result.getUTCDate() + (granularity === 'weekly' ? amount * 7 : amount));
  }

  return result;
}

function getDefaultAnalyticsPeriodStarts(granularity: AnalyticsViewGranularity, referenceDate = new Date()): string[] {
  const periodCount = granularity === 'daily' ? 14 : 12;
  const anchor = getUtcPeriodStart(referenceDate, granularity);
  const result: string[] = [];

  for (let index = periodCount - 1; index >= 0; index -= 1) {
    result.push(formatUtcDate(addAnalyticsPeriod(anchor, granularity, -index)));
  }

  return result;
}

function getAnalyticsViewWindow(
  granularity: AnalyticsViewGranularity,
  range?: AnalyticsViewRange
): { periodStarts: string[]; fromDate: string; toDate?: string } {
  const defaultStarts = getDefaultAnalyticsPeriodStarts(granularity);
  const hasRange = Boolean(range?.from || range?.to);

  if (!hasRange) {
    return {
      periodStarts: defaultStarts,
      fromDate: `${defaultStarts[0] ?? formatUtcDate(getUtcStartOfDay(new Date()))}T00:00:00.000Z`
    };
  }

  const today = formatUtcDate(getUtcStartOfDay(new Date()));
  if (range?.to && !range?.from) {
    const periodStarts = getDefaultAnalyticsPeriodStarts(granularity, parseAnalyticsDate(range.to));

    return {
      periodStarts,
      fromDate: `${periodStarts[0] ?? range.to}T00:00:00.000Z`,
      toDate: addAnalyticsPeriod(parseAnalyticsDate(range.to), 'daily', 1).toISOString()
    };
  }

  const fromDateValue = range?.from ?? defaultStarts[0] ?? today;
  const toDateValue = range?.to ?? (range?.from && range.from > today ? range.from : today);
  const start = getUtcPeriodStart(parseAnalyticsDate(fromDateValue), granularity);
  const end = getUtcPeriodStart(parseAnalyticsDate(toDateValue), granularity);
  const periodStarts: string[] = [];

  for (let date = start; date.getTime() <= end.getTime(); date = addAnalyticsPeriod(date, granularity, 1)) {
    periodStarts.push(formatUtcDate(date));
  }

  return {
    periodStarts,
    fromDate: `${fromDateValue}T00:00:00.000Z`,
    toDate: addAnalyticsPeriod(parseAnalyticsDate(toDateValue), 'daily', 1).toISOString()
  };
}

function fillViewsByPeriod(rows: AnalyticsViewPoint[], periodStarts: string[]): AnalyticsViewPoint[] {
  const byPeriodStart = new Map(rows.map((row) => [row.periodStart, row]));

  return periodStarts.map((periodStart) => ({
    periodStart,
    views: byPeriodStart.get(periodStart)?.views ?? 0,
    uniqueViewers: byPeriodStart.get(periodStart)?.uniqueViewers ?? 0
  }));
}

function encodeFeedCursor(payload: FeedCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeFeedCursor(cursor: string): FeedCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<FeedCursorPayload>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.publishId !== 'string') {
      throw new Error('Invalid feed cursor.');
    }

    return {
      createdAt: parsed.createdAt,
      publishId: parsed.publishId
    };
  } catch {
    throw new HttpError(400, 'Invalid feed cursor.');
  }
}

function getManifestStartCut(manifest: PublishManifest): PublishManifest['cuts'][number] | null {
  if (manifest.episode.startCutId) {
    const configuredStartCut = manifest.cuts.find((cut) => cut.id === manifest.episode.startCutId) ?? null;
    if (configuredStartCut) {
      return configuredStartCut;
    }
  }

  return manifest.cuts.find((cut) => cut.isStart) ?? manifest.cuts[0] ?? null;
}

function isRealFeedChoice(choice: PublishManifest['cuts'][number]['choices'][number]) {
  const normalizedLabel = choice.label.trim().toLowerCase();

  return Boolean(choice.nextCutId) && normalizedLabel.length > 0 && normalizedLabel !== 'new';
}

function getFeedStartCut(manifest: PublishManifest): PublishManifest['cuts'][number] | null {
  const sortedCuts = manifest.cuts.slice().sort((left, right) => left.orderIndex - right.orderIndex);

  return sortedCuts.find((cut) => cut.choices.filter(isRealFeedChoice).length >= 2) ?? null;
}

function buildFeedItem(publish: Publish): FeedItem | null {
  const startCut = getFeedStartCut(publish.manifest);
  if (!startCut) {
    return null;
  }

  const startChoices = startCut.choices.filter(isRealFeedChoice);

  return {
    publishId: publish.id,
    episodeId: publish.episodeId,
    episodeTitle: publish.manifest.episode.title,
    projectTitle: publish.manifest.project.title,
    coverImageUrl: publish.manifest.episode.coverImageUrl ?? null,
    publishedAt: publish.createdAt,
    startCut: {
      id: startCut.id,
      title: startCut.title,
      body: startCut.body,
      contentBlocks: startCut.contentBlocks,
      contentViewMode: startCut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
      assetUrl: startCut.assetUrl,
      edgeFade: startCut.edgeFade ?? DEFAULT_EDGE_FADE,
      edgeFadeIntensity: startCut.edgeFadeIntensity ?? DEFAULT_EDGE_FADE_INTENSITY,
      edgeFadeColor: startCut.edgeFadeColor ?? DEFAULT_EDGE_FADE_COLOR,
      marginBottomToken: startCut.marginBottomToken ?? DEFAULT_CONTENT_SPACING,
      dialogAnchorX: startCut.dialogAnchorX,
      dialogAnchorY: startCut.dialogAnchorY,
      dialogOffsetX: startCut.dialogOffsetX,
      dialogOffsetY: startCut.dialogOffsetY,
      dialogTextAlign: startCut.dialogTextAlign,
      startEffect: startCut.startEffect ?? 'none',
      endEffect: startCut.endEffect ?? 'none',
      startEffectDurationMs: normalizeCutEffectDurationMs(startCut.startEffectDurationMs),
      endEffectDurationMs: normalizeCutEffectDurationMs(startCut.endEffectDurationMs)
    },
    startChoices: startChoices
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((choice) => ({
        id: choice.id,
        label: choice.label,
        orderIndex: choice.orderIndex,
        nextCutId: choice.nextCutId,
        afterSelectReactionText: choice.afterSelectReactionText,
        stateWrites: choice.stateWrites ?? []
      }))
  };
}

function buildProjectedFeedItem(input: {
  feedItem: FeedItem;
  publish: Publish;
  channel: ProjectionChannelInput;
  series: ProjectionSeriesInput;
}): FeedItem {
  return {
    ...input.feedItem,
    id: input.publish.id,
    type: 'promptoon',
    channelId: input.channel.id,
    channelSlug: input.channel.slug,
    channelName: input.channel.display_name,
    channelAvatarUrl: input.channel.avatar_url,
    metrics: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    },
    entry: {
      kind: 'viewer',
      href: `/v/${input.publish.id}`
    }
  };
}

function buildChoiceStats(
  draft: EpisodeDraftResponse,
  clickedStats: Map<string, AnalyticsChoiceStat[]>
): Record<string, AnalyticsChoiceStat[]> {
  const result: Record<string, AnalyticsChoiceStat[]> = {};

  const choicesByCutId = new Map<string, Choice[]>();
  for (const choice of draft.choices) {
    const list = choicesByCutId.get(choice.cutId) ?? [];
    list.push(choice);
    choicesByCutId.set(choice.cutId, list);
  }

  for (const [cutId, choices] of choicesByCutId.entries()) {
    const clickedByChoiceId = new Map((clickedStats.get(cutId) ?? []).map((stat) => [stat.choiceId, stat]));
    const merged = choices
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((choice) => {
        const clickedStat = clickedByChoiceId.get(choice.id);

        return {
          choiceId: choice.id,
          label: choice.label,
          count: clickedStat?.count ?? 0,
          percentage: 0,
          ...(clickedStat?.avgHesitationMs === undefined ? {} : { avgHesitationMs: clickedStat.avgHesitationMs })
        };
      });
    const total = merged.reduce((sum, stat) => sum + stat.count, 0);

    result[cutId] = merged.map((stat) => ({
      ...stat,
      percentage: total === 0 ? 0 : Number(((stat.count / total) * 100).toFixed(1))
    }));
  }

  return result;
}

async function getValidatedDraft(episodeId: string, dbClient?: PoolClient): Promise<{
  draft: EpisodeDraftResponse;
  validation: ValidateEpisodeResponse;
}> {
  const executor = dbClient ?? db;
  const draft = assertExists(await repository.getEpisodeDraft(executor, episodeId), 'Episode not found.');
  const validation = validateEpisodeGraph(draft);
  return { draft, validation };
}

export async function listProjects(userId: string): Promise<ProjectWithEpisodes[]> {
  return repository.listProjectsWithEpisodes(db, userId);
}

export async function exportUserBackup(userId: string): Promise<PromptoonBackupExport> {
  const projects = await repository.getUserBackupProjects(db, userId);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ownerId: userId,
    projects,
    totals: getBackupTotals(projects)
  };
}

export async function createProject(request: CreateProjectRequest, userId: string): Promise<Project> {
  return withTransaction(async (client) => {
    const project = await repository.createProject(client, {
      title: request.title,
      description: request.description,
      createdBy: userId
    });
    await repository.upsertProjectMember(client, {
      projectId: project.id,
      userId,
      role: 'owner'
    });
    await repository.ensureDefaultChannelForProject(client, project, userId);
    return project;
  });
}

export async function listProjectMembers(projectId: string, userId: string): Promise<ProjectMemberListResponse> {
  await ensureProjectOwnedByUser(projectId, userId);

  return {
    members: await repository.listProjectMembers(db, projectId)
  };
}

export async function addProjectMember(
  projectId: string,
  request: UpsertProjectMemberRequest,
  userId: string
): Promise<ProjectMemberListResponse> {
  await ensureProjectOwnedByUser(projectId, userId);
  const targetUserId = assertExists(await repository.getUserIdByLoginId(db, request.loginId), 'User not found.');

  await repository.upsertProjectMember(db, {
    projectId,
    userId: targetUserId,
    role: request.role
  });

  return listProjectMembers(projectId, userId);
}

export async function updateProjectMember(
  projectId: string,
  targetUserId: string,
  request: PatchProjectMemberRequest,
  userId: string
): Promise<ProjectMemberListResponse> {
  await ensureProjectOwnedByUser(projectId, userId);
  const currentRole = await repository.getProjectMemberRole(db, {
    projectId,
    userId: targetUserId
  });
  if (!currentRole) {
    throw new HttpError(404, 'Project member not found.');
  }

  if (currentRole === 'owner') {
    throw new HttpError(400, 'Owner transfer is not supported.');
  }

  await repository.upsertProjectMember(db, {
    projectId,
    userId: targetUserId,
    role: request.role
  });

  return listProjectMembers(projectId, userId);
}

export async function deleteProjectMember(projectId: string, targetUserId: string, userId: string): Promise<ProjectMemberListResponse> {
  await ensureProjectOwnedByUser(projectId, userId);
  const currentRole = await repository.getProjectMemberRole(db, {
    projectId,
    userId: targetUserId
  });
  if (!currentRole) {
    throw new HttpError(404, 'Project member not found.');
  }

  if (currentRole === 'owner') {
    throw new HttpError(400, 'Owner removal is not supported.');
  }

  await repository.deleteProjectMember(db, {
    projectId,
    userId: targetUserId
  });

  return listProjectMembers(projectId, userId);
}

export async function createEpisode(projectId: string, request: CreateEpisodeRequest, userId: string): Promise<Episode> {
  await ensureProjectWritableByUser(projectId, userId);

  try {
    return await repository.createEpisode(db, {
      projectId,
      title: request.title,
      episodeNo: request.episodeNo,
      coverImageUrl: request.coverImageUrl,
      mode: request.mode,
      exitLoopMetadata: request.exitLoopMetadata
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateEpisode(episodeId: string, request: PatchEpisodeRequest, userId: string): Promise<Episode> {
  await ensureEpisodeOwnedByUser(episodeId, userId);

  try {
    return assertExists(await repository.updateEpisode(db, episodeId, request), 'Episode not found.');
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function getEpisodeDraft(episodeId: string, userId: string): Promise<EpisodeDraftResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  return assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
}

function sanitizeLoopGroupId(groupName: string): string {
  const normalized = groupName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const base = normalized || 'exit-loop';
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);

  return `${base}-${suffix}`;
}

function getLoopExpectedChoice(truth: CreateLoopStateSettingRequest['stages'][number]['truth']): 'forward' | 'back' {
  return truth === 'real_anomaly' ? 'back' : 'forward';
}

function getLoopStatePrefix(groupId: string): string {
  return `exitLoop.${groupId}.`;
}

function getLoopRouteStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}route`;
}

function getLoopDecisionStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}decision`;
}

function getLoopDecisionStateWrites(groupId: string, choiceId: 'forward' | 'back'): ChoiceStateWrite[] {
  return [
    {
      key: getLoopDecisionStateKey(groupId),
      operation: 'exitLoopDecision',
      value: choiceId
    }
  ];
}

function getLoopStageTitle(groupName: string, stageIndex: number, title: string | undefined): string {
  return title?.trim() || `${groupName} Stage ${String(stageIndex).padStart(2, '0')}`;
}

function getLoopVariantTitle(groupName: string, stageIndex: number, title: string | undefined): string {
  return title?.trim() || `${groupName} Stage ${String(stageIndex).padStart(2, '0')} Variant`;
}

function getLoopSpacerTitle(groupName: string, stageIndex: number, title: string | undefined): string {
  return title?.trim() || `${groupName} Spacer ${String(stageIndex).padStart(2, '0')}`;
}

function getLoopDecisionTitle(groupName: string): string {
  return `${groupName} Decision`;
}

async function ensureOptionalLoopStateTargetInEpisode(input: {
  cutId: string | null | undefined;
  cutIds: Set<string>;
  label: string;
}): Promise<void> {
  if (!input.cutId) {
    return;
  }

  if (!input.cutIds.has(input.cutId)) {
    throw new HttpError(400, `${input.label} must reference a cut in the same episode.`);
  }
}

export async function createLoopStateSetting(
  episodeId: string,
  request: CreateLoopStateSettingRequest,
  userId: string
): Promise<CreateLoopStateSettingResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  const draft = assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
  const cutIds = new Set(draft.cuts.map((cut) => cut.id));
  const continuationCutId = request.continuationCutId ?? request.successCutId ?? null;
  const retryCutId = request.retryCutId ?? request.failureCutId ?? null;

  await ensureOptionalLoopStateTargetInEpisode({
    cutId: request.attachAfterCutId,
    cutIds,
    label: 'Attach cut'
  });
  await ensureOptionalLoopStateTargetInEpisode({
    cutId: continuationCutId,
    cutIds,
    label: 'Continuation cut'
  });
  await ensureOptionalLoopStateTargetInEpisode({
    cutId: retryCutId,
    cutIds,
    label: 'Retry cut'
  });

  const groupName = request.groupName.trim();
  const groupId = sanitizeLoopGroupId(groupName);
  const statePrefix = getLoopStatePrefix(groupId);
  const stageCount = request.stages.length;
  const exitLevelRequired = request.exitLevelRequired ?? 5;
  const startOrderIndex = draft.cuts.length;
  let loopStateSettingResponse: CreateLoopStateSettingResponse | null = null;

  await withTransaction(async (client) => {
    const stageCuts: Cut[] = [];
    const spacerCuts: Cut[] = [];

    for (const [stageOffset, stage] of request.stages.entries()) {
      const stageIndex = stageOffset + 1;
      const stageOrderIndex = startOrderIndex + stageOffset * 24;
      const stageLoopMetadata: NonNullable<Cut['loopMetadata']> = {
        kind: 'exitLoop',
        groupId,
        groupLabel: groupName,
        role: 'stageBase',
        stageIndex,
        stageCount,
        selectedVariantCutId: null,
        variantCutIds: [],
        exitLevelRequired,
        resetStateOnEnter: false,
        resetStateKeyPrefix: stageIndex === 1 ? statePrefix : undefined
      };
      const stageCut = await repository.createCut(client, {
        episodeId,
        kind: 'loopStage',
        title: getLoopStageTitle(groupName, stageIndex, stage.title),
        body: '',
        assetUrl: stage.baseAssetUrl ?? null,
        loopMetadata: stageLoopMetadata,
        orderIndex: stageOrderIndex,
        positionX: stageOffset * 260,
        positionY: 220
      });
      const variantInputs =
        stage.variants && stage.variants.length > 0
          ? stage.variants
          : stage.truth
            ? [
                {
                  assetUrl: stage.variantAssetUrl ?? stage.baseAssetUrl ?? null,
                  title: stage.variantTitle,
                  truth: stage.truth
                }
              ]
            : [];
      const variantCutIds: string[] = [];

      for (const [variantOffset, variantInput] of variantInputs.entries()) {
        const truth = variantInput.truth;
        const expectedChoice = getLoopExpectedChoice(truth);
        const variantCut = await repository.createCut(client, {
          episodeId,
          kind: 'loopVariant',
          title: getLoopVariantTitle(groupName, stageIndex, variantInput.title),
          body: '',
          assetUrl: variantInput.assetUrl ?? stage.baseAssetUrl ?? null,
          loopMetadata: {
            kind: 'exitLoop',
            groupId,
            groupLabel: groupName,
            role: 'stageVariant',
            stageIndex,
            stageCount,
            truth,
            expectedChoice,
            baseCutId: stageCut.id,
            exitLevelRequired
          },
          orderIndex: stageOrderIndex + 1 + variantOffset,
          positionX: stageOffset * 260,
          positionY: 430 + variantOffset * 92
        });
        variantCutIds.push(variantCut.id);
      }

      const updatedStageCut = assertExists(
        await repository.updateCut(client, stageCut.id, {
          loopMetadata: {
            ...stageLoopMetadata,
            selectedVariantCutId: null,
            variantCutIds
          }
        }),
        'Loop stage cut not found.'
      );
      stageCuts.push(updatedStageCut);

      if (stageIndex < stageCount) {
        spacerCuts.push(
          await repository.createCut(client, {
            episodeId,
            kind: 'loopSpacer',
            title: getLoopSpacerTitle(groupName, stageIndex, stage.spacerTitle),
            body: '',
            assetUrl: stage.spacerAssetUrl ?? null,
            loopMetadata: {
              kind: 'exitLoop',
              groupId,
              groupLabel: groupName,
              role: 'spacer',
              stageIndex,
              stageCount
            },
            orderIndex: stageOrderIndex + 20,
            positionX: stageOffset * 260 + 130,
            positionY: 220
          })
        );
      }
    }

    const firstStageCut = stageCuts[0];
    if (!firstStageCut) {
      throw new HttpError(400, 'LoopStateSetting requires at least one stage.');
    }

    const retryCut = retryCutId
      ? assertExists(await repository.getCutById(client, retryCutId), 'Retry cut not found.')
      : firstStageCut;
    const continuationCut = continuationCutId
      ? assertExists(await repository.getCutById(client, continuationCutId), 'Continuation cut not found.')
      : await repository.createCut(client, {
          episodeId,
          kind: 'scene',
          title: `${groupName} Next`,
          body: '루프 바깥으로 진행합니다.',
          isEnding: false,
          orderIndex: startOrderIndex + stageCount * 24 + 1,
          positionX: stageCount * 260,
          positionY: 430
        });
    const resultRouterCut = await repository.createCut(client, {
      episodeId,
      kind: 'stateRouter',
      title: `${groupName} Result Router`,
      body: '',
      stateRoutes: [
        {
          id: 'loop-result-exit',
          conditions: [
            {
              stateKey: getLoopRouteStateKey(groupId),
              equals: 'exit'
            }
          ],
          nextCutId: continuationCut.id,
          label: 'Exit'
        }
      ],
      stateFallbackCutId: retryCut.id,
      loopMetadata: {
        kind: 'exitLoop',
        groupId,
        groupLabel: groupName,
        role: 'resultRouter',
        stageCount,
        exitLevelRequired
      },
      orderIndex: startOrderIndex + stageCount * 24,
      positionX: stageCount * 260,
      positionY: 220
    });

    for (const [stageOffset, stageCut] of stageCuts.entries()) {
      const isLastStage = stageOffset === stageCuts.length - 1;
      if (isLastStage) {
        await repository.createChoice(client, {
          cutId: stageCut.id,
          label: '나아간다',
          nextCutId: resultRouterCut.id,
          orderIndex: 0,
          stateWrites: getLoopDecisionStateWrites(groupId, 'forward')
        });
        await repository.createChoice(client, {
          cutId: stageCut.id,
          label: '돌아간다',
          nextCutId: resultRouterCut.id,
          orderIndex: 1,
          stateWrites: getLoopDecisionStateWrites(groupId, 'back')
        });
      } else {
        const nextCutId = spacerCuts[stageOffset]?.id ?? resultRouterCut.id;
        await repository.createChoice(client, {
          cutId: stageCut.id,
          label: '계속',
          nextCutId,
          orderIndex: 0
        });
      }

      const nextStageCut = stageCuts[stageOffset + 1] ?? null;
      const spacerCut = spacerCuts[stageOffset] ?? null;
      if (spacerCut && nextStageCut) {
        await repository.createChoice(client, {
          cutId: spacerCut.id,
          label: '계속',
          nextCutId: nextStageCut.id,
          orderIndex: 0
        });
      }
    }

    if (request.attachAfterCutId) {
      await repository.createChoice(client, {
        cutId: request.attachAfterCutId,
        label: groupName,
        nextCutId: firstStageCut.id
      });
    }

    const nextDraft = assertExists(await repository.getEpisodeDraft(client, episodeId), 'Episode not found.');
    loopStateSettingResponse = {
      ...nextDraft,
      groupId,
      firstStageCutId: firstStageCut.id,
      resultRouterCutId: resultRouterCut.id,
      continuationCutId: continuationCut.id,
      retryCutId: retryCut.id,
      successCutId: continuationCut.id,
      failureCutId: retryCut.id
    };
  });

  if (!loopStateSettingResponse) {
    throw new HttpError(500, 'LoopStateSetting was not created.');
  }

  return loopStateSettingResponse;
}

export async function createCut(episodeId: string, request: CreateCutRequest, userId: string): Promise<Cut> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  const stateVariants = normalizeCutStateVariants(request.stateVariants);
  const stateRoutes = normalizeCutStateRoutes(request.stateRoutes);
  const loopMetadata = normalizeCutLoopMetadata(request.loopMetadata);
  assertLoopCutKindMatchesMetadata(request.kind, loopMetadata);
  await ensureStateVariantTargetsInEpisode({
    episodeId,
    stateVariants
  });
  await ensureStateRouterTargetsInEpisode({
    episodeId,
    stateRoutes,
    stateFallbackCutId: request.stateFallbackCutId
  });
  await ensureLoopMetadataTargetsInEpisode({
    episodeId,
    loopMetadata
  });

  try {
    return await repository.createCut(db, {
      episodeId,
      ...request,
      stateVariants,
      stateRoutes,
      loopMetadata
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateCut(cutId: string, request: PatchCutRequest, userId: string): Promise<Cut> {
  await ensureCutOwnedByUser(cutId, userId);
  const cut = assertExists(await repository.getCutById(db, cutId), 'Cut not found.');
  const stateVariants = normalizeCutStateVariants(request.stateVariants);
  const stateRoutes = normalizeCutStateRoutes(request.stateRoutes);
  const loopMetadata = normalizeCutLoopMetadata(request.loopMetadata);
  const nextKind = request.kind ?? cut.kind;
  const nextLoopMetadata = loopMetadata === undefined ? cut.loopMetadata ?? null : loopMetadata;
  assertLoopCutKindMatchesMetadata(nextKind, nextLoopMetadata);
  await ensureStateVariantTargetsInEpisode({
    episodeId: cut.episodeId,
    sourceCutId: cutId,
    stateVariants
  });
  await ensureStateRouterTargetsInEpisode({
    episodeId: cut.episodeId,
    sourceCutId: cutId,
    stateRoutes,
    stateFallbackCutId: request.stateFallbackCutId
  });
  await ensureLoopMetadataTargetsInEpisode({
    episodeId: cut.episodeId,
    sourceCutId: cutId,
    loopMetadata
  });

  try {
    const patch: PatchCutRequest = { ...request, stateVariants, stateRoutes };
    if (loopMetadata !== undefined) {
      patch.loopMetadata = loopMetadata;
    }

    return assertExists(await repository.updateCut(db, cutId, patch), 'Cut not found.');
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateEpisodeCutLayout(
  episodeId: string,
  request: PatchEpisodeCutLayoutRequest,
  userId: string
): Promise<PatchEpisodeCutLayoutResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);

  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const cut of request.cuts) {
    if (seenIds.has(cut.cutId)) {
      duplicateIds.add(cut.cutId);
    }
    seenIds.add(cut.cutId);
  }

  if (duplicateIds.size > 0) {
    throw new HttpError(400, 'Cut layout payload contains duplicate cut IDs.', {
      cutIds: Array.from(duplicateIds)
    });
  }

  try {
    const updatedCuts = await repository.updateEpisodeCutLayout(db, episodeId, request);
    if (updatedCuts.length !== request.cuts.length) {
      throw new HttpError(400, 'Cut layout payload must reference cuts in the episode.');
    }

    return {
      cuts: updatedCuts
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw mapDatabaseError(error);
  }
}

export async function deleteCut(cutId: string, userId: string, request: DeleteCutRequest = {}): Promise<void> {
  await ensureCutOwnedByUser(cutId, userId);

  const cut = assertExists(await repository.getCutById(db, cutId), 'Cut not found.');
  const reconnectToCutId = Object.prototype.hasOwnProperty.call(request, 'reconnectToCutId')
    ? request.reconnectToCutId ?? null
    : null;

  if (reconnectToCutId) {
    if (reconnectToCutId === cutId) {
      throw new HttpError(400, 'Reconnect target cannot be the deleted cut.');
    }

    const reconnectTarget = await repository.getCutById(db, reconnectToCutId);
    if (!reconnectTarget || reconnectTarget.episodeId !== cut.episodeId) {
      throw new HttpError(400, 'Reconnect target must reference a cut in the same episode.');
    }
  }

  await withTransaction(async (client) => {
    await repository.reconnectChoicesTargetingCut(client, {
      cutId,
      reconnectToCutId
    });
    await repository.removeStateVariantsTargetingCut(client, {
      episodeId: cut.episodeId,
      cutId
    });
    await repository.removeStateRoutesTargetingCut(client, {
      episodeId: cut.episodeId,
      cutId
    });

    const deleted = await repository.deleteCut(client, cutId);
    if (!deleted) {
      throw new HttpError(404, 'Cut not found.');
    }
  });
}

export async function createChoice(cutId: string, request: CreateChoiceRequest, userId: string): Promise<Choice> {
  await ensureCutOwnedByUser(cutId, userId);
  const cut = assertExists(await repository.getCutById(db, cutId), 'Cut not found.');

  if (request.nextCutId) {
    const draft = assertExists(await repository.getEpisodeDraft(db, cut.episodeId), 'Episode not found.');
    const existsInEpisode = draft.cuts.some((episodeCut) => episodeCut.id === request.nextCutId);
    if (!existsInEpisode) {
      throw new HttpError(400, 'Choice target must reference a cut in the same episode.');
    }
  }

  try {
    return await repository.createChoice(db, {
      cutId,
      ...request,
      stateWrites: normalizeChoiceStateWrites(request.stateWrites)
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateChoice(choiceId: string, request: PatchChoiceRequest, userId: string): Promise<Choice> {
  await ensureChoiceOwnedByUser(choiceId, userId);
  const existingChoice = assertExists(await repository.getChoiceById(db, choiceId), 'Choice not found.');

  if (request.nextCutId) {
    const cut = assertExists(await repository.getCutById(db, existingChoice.cutId), 'Cut not found.');
    const draft = assertExists(await repository.getEpisodeDraft(db, cut.episodeId), 'Episode not found.');
    const existsInEpisode = draft.cuts.some((episodeCut) => episodeCut.id === request.nextCutId);
    if (!existsInEpisode) {
      throw new HttpError(400, 'Choice target must reference a cut in the same episode.');
    }
  }

  try {
    return assertExists(
      await repository.updateChoice(db, choiceId, {
        ...request,
        stateWrites: normalizeChoiceStateWrites(request.stateWrites)
      }),
      'Choice not found.'
    );
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function deleteChoice(choiceId: string, userId: string): Promise<void> {
  await ensureChoiceOwnedByUser(choiceId, userId);
  assertExists(await repository.getChoiceById(db, choiceId), 'Choice not found.');

  await withTransaction(async (client) => {
    const deleted = await repository.deleteChoice(client, choiceId);
    if (!deleted) {
      throw new HttpError(404, 'Choice not found.');
    }
  });
}

export async function validateEpisode(episodeId: string, userId: string): Promise<ValidateEpisodeResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  const { validation } = await getValidatedDraft(episodeId);
  return validation;
}

export async function getPublishedEpisode(publishId: string): Promise<Publish> {
  return toPublicPublish(normalizePublish(assertPublicPublish(await repository.getPublishById(db, publishId), 'Published episode not found.')));
}

export async function getEpisodeFeed(input: { cursor?: string; limit: number }): Promise<FeedResponse> {
  const cursor = input.cursor ? decodeFeedCursor(input.cursor) : undefined;
  const rows = await repository.listFeedItemProjections(db, {
    cursor,
    limit: input.limit + 1
  });
  const pageRows = rows.slice(0, input.limit);
  const lastRow = pageRows[pageRows.length - 1] ?? null;

  return {
    items: pageRows.map((row) => row.item),
    nextCursor: rows.length > input.limit && lastRow
      ? encodeFeedCursor({
          createdAt: lastRow.publishedAt,
          publishId: lastRow.id
        })
      : null
  };
}

export async function getChannelHome(channelSlug: string): Promise<ChannelHome> {
  const channel = assertExists(await repository.getChannelBySlug(db, channelSlug), 'Channel not found.');
  const projected = await repository.getChannelHomeProjection(db, channel.id);
  if (projected) {
    return projected;
  }

  const rebuilt = assertExists(await repository.buildChannelHomeFromPublicTables(db, channel.id), 'Channel not found.');
  await repository.upsertChannelHomeProjection(db, channel.id, rebuilt);
  return rebuilt;
}

export async function getRelatedShorts(publishId: string): Promise<RelatedShort[]> {
  assertPublicPublish(await repository.getPublishById(db, publishId), 'Published episode not found.');
  return repository.listRelatedShortsForPublish(db, publishId);
}

export async function getCommentsMeta(publishId: string): Promise<CommentsMetaResponse> {
  assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const meta = await repository.getCommentsMetaByPublishId(db, publishId);

  return {
    publishId,
    commentCount: meta?.comment_count ?? 0,
    latestCommentAt: meta?.latest_comment_at ? meta.latest_comment_at.toISOString() : null,
    discussionUrl: meta?.discussion_url ?? null
  };
}

function normalizeInteractionPublishIds(publishIds: string[]): string[] {
  return Array.from(new Set(publishIds.map((publishId) => publishId.trim()).filter(Boolean))).slice(0, 100);
}

async function rebuildChannelProjectionForChannel(executor: DbExecutor, channelId: string | null | undefined): Promise<void> {
  if (!channelId) {
    return;
  }

  const home = await repository.buildChannelHomeFromPublicTables(executor, channelId);
  if (home) {
    await repository.upsertChannelHomeProjection(executor, channelId, home);
  }
}

export async function getContentInteractionStates(
  publishIds: string[],
  userId: string
): Promise<ContentInteractionStateListResponse> {
  const normalizedPublishIds = normalizeInteractionPublishIds(publishIds);

  return {
    items: await repository.listContentInteractionStates(db, {
      publishIds: normalizedPublishIds,
      userId
    })
  };
}

export async function getViewerInteractionState(publishId: string, userId: string): Promise<ViewerInteractionStateResponse> {
  return assertExists(
    await repository.getViewerInteractionState(db, {
      publishId,
      userId
    }),
    'Published episode not found.'
  );
}

export async function getChannelSubscriptionState(
  channelId: string,
  userId: string
): Promise<ChannelSubscriptionStateResponse> {
  return assertExists(
    await repository.getChannelSubscriptionState(db, {
      channelId,
      userId
    }),
    'Channel not found.'
  );
}

export async function likePublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserLike(client, publishId, userId);
    const refreshedContext = await repository.refreshFeedItemLikeMetrics(client, publishId);
    await rebuildChannelProjectionForChannel(client, refreshedContext?.channel_id ?? context.channel_id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_like',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'like'
      }
    });
  });
}

export async function unlikePublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserLike(client, publishId, userId);
    const refreshedContext = await repository.refreshFeedItemLikeMetrics(client, publishId);
    await rebuildChannelProjectionForChannel(client, refreshedContext?.channel_id ?? context.channel_id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_like',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'unlike'
      }
    });
  });
}

export async function bookmarkPublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserBookmark(client, publishId, userId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_bookmark',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'bookmark'
      }
    });
  });
}

export async function unbookmarkPublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserBookmark(client, publishId, userId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_bookmark',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'unbookmark'
      }
    });
  });
}

export async function ensureDiscussionForEpisode(episodeId: string, userId: string): Promise<void> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  await repository.ensureEpisodeDiscussion(db, { episodeId });
}

export async function subscribeToChannel(channelId: string, userId: string): Promise<void> {
  assertExists(await repository.getChannelSubscriptionState(db, { channelId, userId }), 'Channel not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserSubscription(client, channelId, userId);
    await rebuildChannelProjectionForChannel(client, channelId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_subscribe',
      userId,
      channelId,
      payload: {
        action: 'subscribe'
      }
    });
  });
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  assertExists(await repository.getChannelSubscriptionState(db, { channelId, userId }), 'Channel not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserSubscription(client, channelId, userId);
    await rebuildChannelProjectionForChannel(client, channelId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_subscribe',
      userId,
      channelId,
      payload: {
        action: 'unsubscribe'
      }
    });
  });
}

export async function trackTelemetryEvent(payload: TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}

export async function getLatestPublishedEpisode(episodeId: string, userId: string): Promise<Publish | null> {
  await ensureEpisodeProjectRole(episodeId, userId, PROJECT_READ_ROLES);
  const publish = await repository.getLatestPublishByEpisodeId(db, episodeId);
  return publish ? normalizePublish(publish) : null;
}

export async function uploadAsset(projectId: string, file: Express.Multer.File, userId: string): Promise<AssetUploadResponse> {
  await ensureProjectWritableByUser(projectId, userId);

  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'Only image uploads are supported.');
  }

  const now = new Date();
  const publicUploadScope = buildPublicUploadScope();
  const relativeDirectory = path.join(...getDatedUploadSegments(now), publicUploadScope);
  const uploadBaseName = buildProjectUploadBaseName(file, now);
  const originalFileName = buildOriginalUploadFileName(file, uploadBaseName);
  const webpFileName = buildWebpUploadFileName(uploadBaseName);
  const webpBuffer = await convertUploadToWebp(file);

  await writeUploadFiles(relativeDirectory, [
    {
      fileName: originalFileName,
      buffer: file.buffer
    },
    {
      fileName: webpFileName,
      buffer: webpBuffer
    }
  ]);

  return {
    assetUrl: buildAssetUrl(publicUploadScope, webpFileName, now)
  };
}

export async function renderSharePage(
  publishId: string,
  endingCutId: string | undefined,
  baseOrigin: string,
  options: SharePageOptions = {}
): Promise<string> {
  const publish = await getPublishedEpisode(publishId);
  const template = await getBaseShareTemplate();
  const meta = buildSharePageMeta(publish, endingCutId, baseOrigin, options);

  return injectShareTemplate(template, meta);
}

export async function trackViewerEvent(request: TelemetryEventRequest): Promise<void> {
  const publish = assertPublicPublish(await repository.getPublishById(db, request.publishId), 'Published episode not found.');
  const cutsById = new Map(publish.manifest.cuts.map((cut) => [cut.id, cut]));
  const targetCut = cutsById.get(request.cutId);

  if (!targetCut) {
    throw new HttpError(400, 'Telemetry cut must exist in the published manifest.');
  }

  if ((request.eventType === 'ending_reach' || request.eventType === 'ending_share') && !isEndingLikeCut(targetCut)) {
    throw new HttpError(400, 'ending events must target an ending cut.');
  }

  if (request.choiceId) {
    const choiceExists = targetCut.choices.some((choice) => choice.id === request.choiceId);

    if (!choiceExists) {
      throw new HttpError(400, 'Telemetry choice must belong to the provided cut.');
    }
  }

  await repository.createViewerEvent(db, {
    publishId: request.publishId,
    episodeId: publish.episodeId,
    anonymousId: request.anonymousId,
    sessionId: request.sessionId,
    eventType: request.eventType,
    cutId: request.cutId,
    choiceId: request.choiceId,
    durationMs: request.durationMs
  });
  await repository.insertTelemetryEvent(db, {
    eventName: request.eventType,
    anonymousId: request.anonymousId,
    sessionId: request.sessionId,
    projectId: publish.projectId,
    episodeId: publish.episodeId,
    publishId: publish.id,
    payload: {
      cutId: request.cutId,
      choiceId: request.choiceId,
      durationMs: request.durationMs
    }
  });
}

export async function getEpisodeAnalytics(
  episodeId: string,
  userId: string,
  viewsGranularity: AnalyticsViewGranularity = 'daily',
  viewsRange?: AnalyticsViewRange
): Promise<AnalyticsEpisodeResponse> {
  await ensureEpisodeProjectRole(episodeId, userId, PROJECT_READ_ROLES);
  const draft = assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
  const startCutId = getStartCutId(draft);
  const viewWindow = getAnalyticsViewWindow(viewsGranularity, viewsRange);

  const [
    choiceEngaged,
    endingReached,
    choiceStatsMap,
    cutEngagementMap,
    endingDistribution,
    replayViewers,
    rawViewsByPeriod,
    totalViews,
    uniqueViewers,
    feedImpressions,
    feedChoiceClicks
  ] = await Promise.all([
    repository.countViewerEvents(db, { episodeId, eventType: 'choice_click', distinctAnonymous: true }),
    repository.countViewerEvents(db, { episodeId, eventType: 'ending_reach', distinctAnonymous: true }),
    repository.getChoiceClickStats(db, episodeId),
    repository.getCutEngagementStats(db, episodeId),
    repository.getEndingDistributionStats(db, episodeId),
    startCutId ? repository.countReplayViewers(db, { episodeId, startCutId }) : Promise.resolve(0),
    startCutId
      ? repository.getStartViewsByPeriod(db, {
          episodeId,
          startCutId,
          granularity: viewsGranularity,
          fromDate: viewWindow.fromDate,
          toDate: viewWindow.toDate
        })
      : Promise.resolve([]),
    startCutId ? repository.countViewerEvents(db, { episodeId, eventType: 'cut_view', cutId: startCutId }) : Promise.resolve(0),
    startCutId
      ? repository.countViewerEvents(db, { episodeId, eventType: 'cut_view', cutId: startCutId, distinctAnonymous: true })
      : Promise.resolve(0),
    repository.countViewerEvents(db, { episodeId, eventType: 'feed_impression' }),
    repository.countViewerEvents(db, { episodeId, eventType: 'feed_choice_click' })
  ]);

  return {
    totalViews,
    uniqueViewers,
    completionRate: uniqueViewers === 0 ? 0 : Number(((endingReached / uniqueViewers) * 100).toFixed(1)),
    replayRate: uniqueViewers === 0 ? 0 : Number(((replayViewers / uniqueViewers) * 100).toFixed(1)),
    funnel: [
      { key: 'start_view', label: '시작', viewers: uniqueViewers },
      { key: 'choice_engaged', label: '선택', viewers: choiceEngaged },
      { key: 'ending_reached', label: '엔딩', viewers: endingReached }
    ],
    cutEngagement: draft.cuts.map((cut) => ({
      cutId: cut.id,
      dropOffCount: cutEngagementMap.get(cut.id)?.dropOffCount ?? 0,
      avgDurationMs: cutEngagementMap.get(cut.id)?.avgDurationMs ?? 0
    })),
    choiceStats: buildChoiceStats(draft, choiceStatsMap),
    endingDistribution,
    viewGranularity: viewsGranularity,
    viewsByPeriod: fillViewsByPeriod(rawViewsByPeriod, viewWindow.periodStarts),
    feedEntry: {
      impressions: feedImpressions,
      choiceClicks: feedChoiceClicks,
      conversionRate: feedImpressions === 0 ? 0 : Number(((feedChoiceClicks / feedImpressions) * 100).toFixed(1))
    }
  };
}

export async function resetEpisodeAnalytics(
  episodeId: string,
  userId: string,
  request: ResetEpisodeAnalyticsRequest
): Promise<void> {
  await ensureEpisodeProjectRole(episodeId, userId, PROJECT_PUBLISH_ROLES);
  const draft = request.scope === 'views' ? assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.') : null;

  await repository.deleteViewerEventsForAnalyticsScope(db, {
    episodeId,
    scope: request.scope,
    startCutId: draft ? getStartCutId(draft) : null
  });
}

export async function reorderEpisodeCuts(
  episodeId: string,
  request: ReorderEpisodeCutsRequest,
  userId: string
): Promise<ReorderEpisodeCutsResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);

  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const cut of request.cuts) {
    if (seenIds.has(cut.cutId)) {
      duplicateIds.add(cut.cutId);
    }
    seenIds.add(cut.cutId);
  }

  if (duplicateIds.size > 0) {
    throw new HttpError(400, 'Cut reorder payload contains duplicate cut IDs.', {
      cutIds: Array.from(duplicateIds)
    });
  }

  return withTransaction(async (client) => {
    const reorderedCuts = await repository.reorderEpisodeCuts(client, episodeId, request);
    if (reorderedCuts.length !== request.cuts.length) {
      throw new HttpError(400, 'Cut reorder payload must contain all cuts in the episode and no foreign cut IDs.');
    }

    return {
      cuts: reorderedCuts
    };
  });
}

export async function publishProject(projectId: string, request: PublishRequest, userId: string): Promise<Publish> {
  await ensureProjectPublishableByUser(projectId, userId);
  await ensureEpisodeBelongsToProject(projectId, request.episodeId);

  return withTransaction(async (client) => {
    await repository.lockEpisodeForPublish(client, request.episodeId);

    const project = assertExists(await repository.getProjectById(client, projectId), 'Project not found.');
    const channel = await repository.ensureDefaultChannelForProject(client, project, userId);
    const series = await repository.ensureDefaultSeriesForProject(client, {
      project,
      channelId: channel.id
    });
    const { draft, validation } = await getValidatedDraft(request.episodeId, client);
    if (!validation.isValid) {
      throw new HttpError(409, 'Episode validation failed.', validation);
    }

    const versionNo = (await repository.getLatestPublishVersion(client, projectId, request.episodeId)) + 1;
    await repository.markProjectPublished(client, projectId);
    await repository.markEpisodePublished(client, request.episodeId);

    const manifest = buildManifest(
      {
        ...draft,
        episode: {
          ...draft.episode,
          status: 'published'
        }
      },
      {
        ...project,
        status: 'published'
      }
    );

    const publish = await repository.createPublish(client, {
      projectId,
      episodeId: request.episodeId,
      channelId: channel.id,
      seriesId: series.id,
      versionNo,
      manifest,
      createdBy: userId
    });
    await coreProjectionService.upsertPublishPublicProjections(client, {
      publish,
      channel,
      series
    });
    await repository.insertTelemetryEvent(client, {
      eventName: 'studio_publish',
      userId,
      projectId,
      channelId: channel.id,
      seriesId: series.id,
      episodeId: request.episodeId,
      publishId: publish.id,
      payload: {
        versionNo
      }
    });

    return publish;
  });
}

export async function updatePublishedProject(projectId: string, request: PublishRequest, userId: string): Promise<Publish> {
  await ensureProjectPublishableByUser(projectId, userId);
  await ensureEpisodeBelongsToProject(projectId, request.episodeId);

  return withTransaction(async (client) => {
    await repository.lockEpisodeForPublish(client, request.episodeId);

    const project = assertExists(await repository.getProjectById(client, projectId), 'Project not found.');
    const channel = await repository.ensureDefaultChannelForProject(client, project, userId);
    const series = await repository.ensureDefaultSeriesForProject(client, {
      project,
      channelId: channel.id
    });
    const existingPublish = assertExists(
      await repository.getLatestPublishByEpisodeId(client, request.episodeId),
      'Published episode not found.'
    );
    const { draft, validation } = await getValidatedDraft(request.episodeId, client);
    if (!validation.isValid) {
      throw new HttpError(409, 'Episode validation failed.', validation);
    }

    await repository.markProjectPublished(client, projectId);
    await repository.markEpisodePublished(client, request.episodeId);

    const manifest = buildManifest(
      {
        ...draft,
        episode: {
          ...draft.episode,
          status: 'published'
        }
      },
      {
        ...project,
        status: 'published'
      }
    );

    const publish = assertExists(
      await repository.updateLatestPublishForEpisode(client, {
        projectId,
        episodeId: existingPublish.episodeId,
        channelId: channel.id,
        seriesId: series.id,
        manifest,
        createdBy: userId
      }),
      'Published episode not found.'
    );
    await coreProjectionService.upsertPublishPublicProjections(client, {
      publish,
      channel,
      series
    });

    return publish;
  });
}

export async function unpublishProject(projectId: string, request: PublishRequest, userId: string): Promise<void> {
  await ensureProjectPublishableByUser(projectId, userId);
  await ensureEpisodeBelongsToProject(projectId, request.episodeId);

  await withTransaction(async (client) => {
    await repository.lockEpisodeForPublish(client, request.episodeId);
    const project = assertExists(await repository.getProjectById(client, projectId), 'Project not found.');
    const channel = await repository.ensureDefaultChannelForProject(client, project, userId);

    await repository.markPublishesUnpublishedForEpisode(client, projectId, request.episodeId);
    await repository.deleteFeedItemProjectionForEpisode(client, request.episodeId);
    await repository.markEpisodeDraft(client, request.episodeId);

    const hasPublishedEpisodes = await repository.projectHasPublishedEpisodes(client, projectId);
    if (!hasPublishedEpisodes) {
      await repository.markProjectDraft(client, projectId);
    }
    await coreProjectionService.rebuildChannelProjectionForChannel(client, channel.id);
  });
}

export async function rebuildPublicProjections(userId: string): Promise<RebuildPublicProjectionsResponse> {
  await ensureStudioAdmin(userId);

  return withTransaction((client) => coreProjectionService.rebuildPublicProjections(client));
}

function mapDatabaseError(error: unknown): Error {
  if (error instanceof HttpError) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  ) {
    return new HttpError(409, 'Unique constraint violation.');
  }

  return error as Error;
}
