import type {
  Choice,
  ChoiceStateWrite,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateEpisodeRequest,
  CreateLoopStateSettingRequest,
  CreateLoopStateSettingResponse,
  Cut,
  CutStateRoute,
  CutStateVariant,
  DeleteCutRequest,
  Episode,
  EpisodeDraftResponse,
  PatchChoiceRequest,
  PatchCutRequest,
  PatchEpisodeRequest,
  PatchEpisodeCutLayoutRequest,
  PatchEpisodeCutLayoutResponse,
  ProductPublish,
  Publish,
  ReorderEpisodeCutsRequest,
  ReorderEpisodeCutsResponse,
  ValidateEpisodeResponse
} from '@promptoon/shared';
import {
  MAX_CUT_STATE_ROUTE_CONDITIONS,
  getCutStateRouteConditions
} from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import { db, withTransaction, type DbExecutor } from '../../db';
import { HttpError } from '../../lib/http-error';
import { validateEpisodeGraph } from '../promptoon-authoring/promptoon.validators';
import * as repository from './editor.repository';
import * as publicationService from './publication.service';

function assertExists<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new HttpError(404, message);
  }

  return value;
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

async function getValidatedDraft(episodeId: string): Promise<{
  draft: EpisodeDraftResponse;
  validation: ValidateEpisodeResponse;
}> {
  const draft = assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
  const project = assertExists(await repository.getProjectById(db, draft.episode.projectId), 'Project not found.');
  const validation = validateEpisodeGraph(draft, {
    projectThumbnailUrl: project.thumbnailUrl
  });
  return { draft, validation };
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

export async function createEpisode(projectId: string, request: CreateEpisodeRequest): Promise<Episode> {
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

export async function getEpisodeDraft(episodeId: string): Promise<EpisodeDraftResponse> {
  return assertExists(await repository.getEpisodeDraft(db, episodeId), 'Episode not found.');
}

export async function updateEpisode(episodeId: string, request: PatchEpisodeRequest): Promise<Episode> {
  try {
    return assertExists(await repository.updateEpisode(db, episodeId, request), 'Episode not found.');
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function getLatestPublishedEpisode(episodeId: string): Promise<Publish | null> {
  const publish = await repository.getLatestPublishByEpisodeId(db, episodeId);
  return publish ? publicationService.toPublicPublish(publicationService.normalizePublish(publish)) : null;
}

export async function getEpisodeTestViewerPublish(episodeId: string): Promise<ProductPublish> {
  const { draft, validation } = await getValidatedDraft(episodeId);
  if (!validation.isValid) {
    throw new HttpError(409, 'Episode validation failed.', validation);
  }

  const project = assertExists(await repository.getProjectById(db, draft.episode.projectId), 'Project not found.');
  const manifest = publicationService.buildManifest(
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
  const publish: Publish = {
    id: `test:${episodeId}`,
    projectId: project.id,
    episodeId,
    versionNo: 0,
    status: 'published',
    manifest,
    createdBy: project.createdBy,
    createdAt: new Date().toISOString()
  };

  return publicationService.toPublicPublish(publicationService.normalizePublish(publish)) as ProductPublish;
}

export async function createCut(episodeId: string, request: CreateCutRequest): Promise<Cut> {
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

export async function reorderEpisodeCuts(
  episodeId: string,
  request: ReorderEpisodeCutsRequest
): Promise<ReorderEpisodeCutsResponse> {
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

export async function updateEpisodeCutLayout(
  episodeId: string,
  request: PatchEpisodeCutLayoutRequest
): Promise<PatchEpisodeCutLayoutResponse> {
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

async function createLoopStateSettingInTransaction(
  client: DbExecutor,
  episodeId: string,
  request: CreateLoopStateSettingRequest
): Promise<CreateLoopStateSettingResponse> {
  const draft = assertExists(await repository.getEpisodeDraft(client, episodeId), 'Episode not found.');
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
  return {
    ...nextDraft,
    groupId,
    firstStageCutId: firstStageCut.id,
    resultRouterCutId: resultRouterCut.id,
    continuationCutId: continuationCut.id,
    retryCutId: retryCut.id,
    successCutId: continuationCut.id,
    failureCutId: retryCut.id
  };
}

export async function createLoopStateSetting(
  episodeId: string,
  request: CreateLoopStateSettingRequest
): Promise<CreateLoopStateSettingResponse> {
  let loopStateSettingResponse: CreateLoopStateSettingResponse | null = null;
  await withTransaction(async (client) => {
    loopStateSettingResponse = await createLoopStateSettingInTransaction(client, episodeId, request);
  });

  if (!loopStateSettingResponse) {
    throw new HttpError(500, 'LoopStateSetting was not created.');
  }

  return loopStateSettingResponse;
}

async function deleteLoopStateSettingInTransaction(
  client: DbExecutor,
  episodeId: string,
  groupId: string
): Promise<EpisodeDraftResponse> {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new HttpError(400, 'LoopStateSetting group id is required.');
  }

  const groupCuts = await repository.listLoopStateSettingCuts(client, episodeId, normalizedGroupId);
  if (groupCuts.length === 0) {
    throw new HttpError(404, 'LoopStateSetting not found.');
  }

  const groupCutIds = groupCuts.map((cut) => cut.id);
  await repository.deleteChoicesTargetingCuts(client, {
    episodeId,
    cutIds: groupCutIds
  });
  await repository.removeStateVariantsTargetingCuts(client, {
    episodeId,
    cutIds: groupCutIds
  });
  await repository.removeStateRoutesTargetingCuts(client, {
    episodeId,
    cutIds: groupCutIds
  });

  const deletedCount = await repository.deleteLoopStateSettingCuts(client, episodeId, normalizedGroupId);
  if (deletedCount === 0) {
    throw new HttpError(404, 'LoopStateSetting not found.');
  }

  return assertExists(await repository.getEpisodeDraft(client, episodeId), 'Episode not found.');
}

export async function deleteLoopStateSetting(episodeId: string, groupId: string): Promise<EpisodeDraftResponse> {
  let nextDraft: EpisodeDraftResponse | null = null;
  await withTransaction(async (client) => {
    nextDraft = await deleteLoopStateSettingInTransaction(client, episodeId, groupId);
  });
  if (!nextDraft) {
    throw new HttpError(500, 'LoopStateSetting was not deleted.');
  }

  return nextDraft;
}

export async function updateLoopStateSetting(
  episodeId: string,
  groupId: string,
  request: CreateLoopStateSettingRequest
): Promise<CreateLoopStateSettingResponse> {
  let loopStateSettingResponse: CreateLoopStateSettingResponse | null = null;
  await withTransaction(async (client) => {
    await deleteLoopStateSettingInTransaction(client, episodeId, groupId);
    loopStateSettingResponse = await createLoopStateSettingInTransaction(client, episodeId, request);
  });

  if (!loopStateSettingResponse) {
    throw new HttpError(500, 'LoopStateSetting was not updated.');
  }

  return loopStateSettingResponse;
}

export async function updateCut(cutId: string, request: PatchCutRequest): Promise<Cut> {
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

export async function deleteCut(cutId: string, request: DeleteCutRequest = {}): Promise<void> {
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

export async function createChoice(cutId: string, request: CreateChoiceRequest): Promise<Choice> {
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

export async function updateChoice(choiceId: string, request: PatchChoiceRequest): Promise<Choice> {
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

export async function deleteChoice(choiceId: string): Promise<void> {
  assertExists(await repository.getChoiceById(db, choiceId), 'Choice not found.');

  await withTransaction(async (client) => {
    const deleted = await repository.deleteChoice(client, choiceId);
    if (!deleted) {
      throw new HttpError(404, 'Choice not found.');
    }
  });
}

export async function validateEpisode(episodeId: string): Promise<ValidateEpisodeResponse> {
  const { validation } = await getValidatedDraft(episodeId);
  return validation;
}
