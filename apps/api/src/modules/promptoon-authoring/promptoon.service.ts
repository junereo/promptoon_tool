import type {
  AssetUploadResponse,
  AnalyticsChoiceStat,
  AnalyticsDailyView,
  AnalyticsEpisodeResponse,
  Choice,
  CutContentBlock,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateEpisodeRequest,
  CreateProjectRequest,
  Cut,
  Episode,
  EpisodeDraftResponse,
  FeedItem,
  FeedResponse,
  PatchChoiceRequest,
  PatchCutRequest,
  Project,
  ProjectWithEpisodes,
  Publish,
  PublishManifest,
  PublishRequest,
  ReorderEpisodeCutsRequest,
  ReorderEpisodeCutsResponse,
  TelemetryEventRequest,
  ValidateEpisodeResponse
} from '@promptoon/shared';
import { DEFAULT_CONTENT_VIEW_MODE, DEFAULT_CUT_EFFECT_DURATION_MS, deriveCutBody, getNormalizedCutContentBlocks } from '@promptoon/shared';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as repository from './promptoon.repository';
import { validateEpisodeGraph } from './promptoon.validators';

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

interface SharePageMeta {
  title: string;
  description: string;
  imageUrl: string | null;
  redirectUrl: string;
  shareUrl: string;
}

interface FeedCursorPayload {
  createdAt: string;
  publishId: string;
}

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
    cuts: manifest.cuts.map((cut) => {
      const contentBlocks = normalizeManifestContentBlocks(cut);

      return {
        ...cut,
        body: deriveCutBody(contentBlocks, cut.body),
        contentBlocks,
        contentViewMode: cut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
        startEffect: cut.startEffect ?? 'none',
        endEffect: cut.endEffect ?? 'none',
        startEffectDurationMs: normalizeCutEffectDurationMs(cut.startEffectDurationMs),
        endEffectDurationMs: normalizeCutEffectDurationMs(cut.endEffectDurationMs),
        choices: cut.choices.map((choice) => ({
          ...choice,
          afterSelectReactionText: choice.afterSelectReactionText ?? undefined
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

async function ensureProjectOwnedByUser(projectId: string, userId: string): Promise<void> {
  const ownerId = await repository.getProjectOwnerId(db, projectId);
  if (!ownerId) {
    throw new HttpError(404, 'Project not found.');
  }

  if (ownerId !== userId) {
    throw new HttpError(403, 'You do not have access to this project.');
  }
}

async function ensureEpisodeOwnedByUser(episodeId: string, userId: string): Promise<void> {
  const ownerId = await repository.getEpisodeOwnerId(db, episodeId);
  if (!ownerId) {
    throw new HttpError(404, 'Episode not found.');
  }

  if (ownerId !== userId) {
    throw new HttpError(403, 'You do not have access to this episode.');
  }
}

async function ensureCutOwnedByUser(cutId: string, userId: string): Promise<void> {
  const ownerId = await repository.getCutOwnerId(db, cutId);
  if (!ownerId) {
    throw new HttpError(404, 'Cut not found.');
  }

  if (ownerId !== userId) {
    throw new HttpError(403, 'You do not have access to this cut.');
  }
}

async function ensureChoiceOwnedByUser(choiceId: string, userId: string): Promise<void> {
  const ownerId = await repository.getChoiceOwnerId(db, choiceId);
  if (!ownerId) {
    throw new HttpError(404, 'Choice not found.');
  }

  if (ownerId !== userId) {
    throw new HttpError(403, 'You do not have access to this choice.');
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
      status: draft.episode.status,
      startCutId: draft.episode.startCutId
    },
    cuts: draft.cuts.map((cut) => ({
      contentBlocks: getNormalizedCutContentBlocks(cut),
      id: cut.id,
      kind: cut.kind,
      title: cut.title,
      body: deriveCutBody(getNormalizedCutContentBlocks(cut), cut.body),
      contentViewMode: cut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
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
      choices: (choicesByCutId.get(cut.id) ?? []).map((choice) => ({
        id: choice.id,
        label: choice.label,
        orderIndex: choice.orderIndex,
        nextCutId: choice.nextCutId,
        afterSelectReactionText: choice.afterSelectReactionText
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
  return path.resolve(process.cwd(), '.data/uploads');
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

function summarizeDescription(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function getShareImageUrl(publish: Publish, endingCutId: string | undefined, baseOrigin: string): string | null {
  const manifest = publish.manifest;
  const endingCut =
    endingCutId
      ? manifest.cuts.find((cut) => cut.id === endingCutId && (cut.isEnding || cut.kind === 'ending')) ?? null
      : null;
  const fallbackCutWithImage = manifest.cuts.find((cut) => Boolean(cut.assetUrl)) ?? null;

  return (
    toAbsoluteUrl(baseOrigin, endingCut?.assetUrl) ??
    toAbsoluteUrl(baseOrigin, fallbackCutWithImage?.assetUrl) ??
    toAbsoluteUrl(baseOrigin, manifest.project.thumbnailUrl)
  );
}

function buildSharePageMeta(publish: Publish, endingCutId: string | undefined, baseOrigin: string): SharePageMeta {
  const manifest = publish.manifest;
  const validEndingCut =
    endingCutId
      ? manifest.cuts.find((cut) => cut.id === endingCutId && (cut.isEnding || cut.kind === 'ending')) ?? null
      : null;
  const querySuffix = validEndingCut ? `?e=${encodeURIComponent(validEndingCut.id)}` : '';
  const redirectUrl = `${trimTrailingSlash(baseOrigin)}/v/${publish.id}${querySuffix}`;
  const shareUrl = `${trimTrailingSlash(baseOrigin)}/api/promptoon/share/${publish.id}${querySuffix}`;
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
    return await readFile(path.resolve(process.cwd(), 'apps/web/index.html'), 'utf8');
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

function fillDailyViews(rows: AnalyticsDailyView[], days: number): AnalyticsDailyView[] {
  const byDate = new Map(rows.map((row) => [row.date, row.views]));
  const result: AnalyticsDailyView[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    const isoDate = date.toISOString().slice(0, 10);

    result.push({
      date: isoDate,
      views: byDate.get(isoDate) ?? 0
    });
  }

  return result;
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
    projectId: publish.projectId,
    episodeTitle: publish.manifest.episode.title,
    projectTitle: publish.manifest.project.title,
    publishedAt: publish.createdAt,
    startCut: {
      id: startCut.id,
      title: startCut.title,
      body: startCut.body,
      contentBlocks: startCut.contentBlocks,
      contentViewMode: startCut.contentViewMode ?? DEFAULT_CONTENT_VIEW_MODE,
      assetUrl: startCut.assetUrl,
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
        afterSelectReactionText: choice.afterSelectReactionText
      }))
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
      .map((choice) => ({
        choiceId: choice.id,
        label: choice.label,
        count: clickedByChoiceId.get(choice.id)?.count ?? 0,
        percentage: 0
      }));
    const total = merged.reduce((sum, stat) => sum + stat.count, 0);

    result[cutId] = merged.map((stat) => ({
      ...stat,
      percentage: total === 0 ? 0 : Number(((stat.count / total) * 100).toFixed(1))
    }));
  }

  return result;
}

function getDerivedBranchKind(choiceCount: number): Cut['kind'] {
  return choiceCount >= 2 ? 'choice' : 'scene';
}

async function normalizeBranchCutKind(dbClient: PoolClient | typeof db, cutId: string): Promise<void> {
  const cut = await repository.getCutById(dbClient, cutId);
  if (!cut || (cut.kind !== 'scene' && cut.kind !== 'choice')) {
    return;
  }

  const choiceCount = await repository.countChoicesForCut(dbClient, cutId);
  const normalizedKind = getDerivedBranchKind(choiceCount);
  if (cut.kind === normalizedKind && cut.isEnding === false) {
    return;
  }

  await repository.updateCut(dbClient, cutId, {
    kind: normalizedKind,
    isEnding: false
  });
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

export async function createProject(request: CreateProjectRequest, userId: string): Promise<Project> {
  return repository.createProject(db, {
    title: request.title,
    description: request.description,
    createdBy: userId
  });
}

export async function createEpisode(projectId: string, request: CreateEpisodeRequest, userId: string): Promise<Episode> {
  await ensureProjectOwnedByUser(projectId, userId);

  try {
    return await repository.createEpisode(db, {
      projectId,
      title: request.title,
      episodeNo: request.episodeNo
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function getEpisodeDraft(episodeId: string, userId: string): Promise<EpisodeDraftResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  return assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
}

export async function createCut(episodeId: string, request: CreateCutRequest, userId: string): Promise<Cut> {
  await ensureEpisodeOwnedByUser(episodeId, userId);

  try {
    return await repository.createCut(db, {
      episodeId,
      ...request
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateCut(cutId: string, request: PatchCutRequest, userId: string): Promise<Cut> {
  await ensureCutOwnedByUser(cutId, userId);

  try {
    const normalizedRequest =
      request.kind === 'scene' || request.kind === 'choice'
        ? {
            ...request,
            kind: getDerivedBranchKind(await repository.countChoicesForCut(db, cutId)),
            isEnding: false
          }
        : request;

    return assertExists(await repository.updateCut(db, cutId, normalizedRequest), 'Cut not found.');
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function deleteCut(cutId: string, userId: string): Promise<void> {
  await ensureCutOwnedByUser(cutId, userId);
  const deleted = await repository.deleteCut(db, cutId);
  if (!deleted) {
    throw new HttpError(404, 'Cut not found.');
  }
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
    return await withTransaction(async (client) => {
      const createdChoice = await repository.createChoice(client, {
        cutId,
        ...request
      });
      await normalizeBranchCutKind(client, cutId);
      return createdChoice;
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
    return assertExists(await repository.updateChoice(db, choiceId, request), 'Choice not found.');
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function deleteChoice(choiceId: string, userId: string): Promise<void> {
  await ensureChoiceOwnedByUser(choiceId, userId);
  const choice = assertExists(await repository.getChoiceById(db, choiceId), 'Choice not found.');

  await withTransaction(async (client) => {
    const deleted = await repository.deleteChoice(client, choiceId);
    if (!deleted) {
      throw new HttpError(404, 'Choice not found.');
    }

    await normalizeBranchCutKind(client, choice.cutId);
  });
}

export async function validateEpisode(episodeId: string, userId: string): Promise<ValidateEpisodeResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  const { validation } = await getValidatedDraft(episodeId);
  return validation;
}

export async function getPublishedEpisode(publishId: string): Promise<Publish> {
  return normalizePublish(assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.'));
}

export async function getEpisodeFeed(input: { cursor?: string; limit: number }): Promise<FeedResponse> {
  let cursor = input.cursor ? decodeFeedCursor(input.cursor) : undefined;
  let lastConsumedPublish: Publish | null = null;
  let hasMorePublishes = false;
  const items: FeedItem[] = [];
  const batchSize = Math.max(input.limit * 2, 10);

  while (items.length < input.limit) {
    const publishes = await repository.listLatestPublishesForFeed(db, {
      cursor,
      limit: batchSize
    });

    if (publishes.length === 0) {
      hasMorePublishes = false;
      break;
    }

    hasMorePublishes = publishes.length === batchSize;

    for (let index = 0; index < publishes.length; index += 1) {
      const publish = publishes[index];
      const normalizedPublish = normalizePublish(publish);
      lastConsumedPublish = publish;
      cursor = {
        createdAt: publish.createdAt,
        publishId: publish.id
      };

      const item = buildFeedItem(normalizedPublish);
      if (item) {
        items.push(item);
      }

      if (items.length >= input.limit) {
        hasMorePublishes = index < publishes.length - 1 || publishes.length === batchSize;
        break;
      }
    }

    if (!hasMorePublishes || !cursor) {
      break;
    }
  }

  return {
    items: items.slice(0, input.limit),
    nextCursor: items.length >= input.limit && hasMorePublishes && lastConsumedPublish
      ? encodeFeedCursor({
          createdAt: lastConsumedPublish.createdAt,
          publishId: lastConsumedPublish.id
        })
      : null
  };
}

export async function getLatestPublishedEpisode(episodeId: string, userId: string): Promise<Publish | null> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  const publish = await repository.getLatestPublishByEpisodeId(db, episodeId);
  return publish ? normalizePublish(publish) : null;
}

export async function uploadAsset(file: Express.Multer.File): Promise<AssetUploadResponse> {
  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'Only image uploads are supported.');
  }

  const uploadsDirectory = getUploadsDirectory();
  const fileName = `${randomUUID()}${getUploadExtension(file)}`;

  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(path.join(uploadsDirectory, fileName), file.buffer);

  return {
    assetUrl: `/uploads/${fileName}`
  };
}

export async function renderSharePage(
  publishId: string,
  endingCutId: string | undefined,
  baseOrigin: string
): Promise<string> {
  const publish = await getPublishedEpisode(publishId);
  const template = await getBaseShareTemplate();
  const meta = buildSharePageMeta(publish, endingCutId, baseOrigin);

  return injectShareTemplate(template, meta);
}

export async function trackViewerEvent(request: TelemetryEventRequest): Promise<void> {
  const publish = assertExists(await repository.getPublishById(db, request.publishId), 'Published episode not found.');
  const cutsById = new Map(publish.manifest.cuts.map((cut) => [cut.id, cut]));
  const targetCut = cutsById.get(request.cutId);

  if (!targetCut) {
    throw new HttpError(400, 'Telemetry cut must exist in the published manifest.');
  }

  if (request.eventType === 'ending_reach' && !(targetCut.isEnding || targetCut.kind === 'ending')) {
    throw new HttpError(400, 'ending_reach events must target an ending cut.');
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
    eventType: request.eventType,
    cutId: request.cutId,
    choiceId: request.choiceId
  });
}

export async function getEpisodeAnalytics(episodeId: string, userId: string): Promise<AnalyticsEpisodeResponse> {
  await ensureEpisodeOwnedByUser(episodeId, userId);
  const draft = assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
  const startCutId = getStartCutId(draft);

  const [choiceEngaged, endingReached, choiceStatsMap, rawDailyViews, totalViews, uniqueViewers, feedImpressions, feedChoiceClicks] = await Promise.all([
    repository.countViewerEvents(db, { episodeId, eventType: 'choice_click', distinctAnonymous: true }),
    repository.countViewerEvents(db, { episodeId, eventType: 'ending_reach', distinctAnonymous: true }),
    repository.getChoiceClickStats(db, episodeId),
    startCutId ? repository.getDailyStartViews(db, { episodeId, startCutId, days: 14 }) : Promise.resolve([]),
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
    funnel: [
      { key: 'start_view', label: '시작', viewers: uniqueViewers },
      { key: 'choice_engaged', label: '선택', viewers: choiceEngaged },
      { key: 'ending_reached', label: '엔딩', viewers: endingReached }
    ],
    choiceStats: buildChoiceStats(draft, choiceStatsMap),
    dailyViews: fillDailyViews(rawDailyViews, 14),
    feedEntry: {
      impressions: feedImpressions,
      choiceClicks: feedChoiceClicks,
      conversionRate: feedImpressions === 0 ? 0 : Number(((feedChoiceClicks / feedImpressions) * 100).toFixed(1))
    }
  };
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
  await ensureProjectOwnedByUser(projectId, userId);
  await ensureEpisodeBelongsToProject(projectId, request.episodeId);

  return withTransaction(async (client) => {
    await repository.lockEpisodeForPublish(client, request.episodeId);

    const project = assertExists(await repository.getProjectById(client, projectId), 'Project not found.');
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

    return repository.createPublish(client, {
      projectId,
      episodeId: request.episodeId,
      versionNo,
      manifest,
      createdBy: userId
    });
  });
}

export async function unpublishProject(projectId: string, request: PublishRequest, userId: string): Promise<void> {
  await ensureProjectOwnedByUser(projectId, userId);
  await ensureEpisodeBelongsToProject(projectId, request.episodeId);

  await withTransaction(async (client) => {
    await repository.lockEpisodeForPublish(client, request.episodeId);

    await repository.deletePublishesForEpisode(client, projectId, request.episodeId);
    await repository.markEpisodeDraft(client, request.episodeId);

    const hasPublishedEpisodes = await repository.projectHasPublishedEpisodes(client, projectId);
    if (!hasPublishedEpisodes) {
      await repository.markProjectDraft(client, projectId);
    }
  });
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
