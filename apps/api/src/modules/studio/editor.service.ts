import type {
  Choice,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateEpisodeRequest,
  CreateLoopStateSettingRequest,
  CreateLoopStateSettingResponse,
  Cut,
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

import * as editorCoreService from '../promptoon-core/editor.service';
import * as authorizationService from './authorization.service';

export async function createEpisode(projectId: string, request: CreateEpisodeRequest, userId: string): Promise<Episode> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  return editorCoreService.createEpisode(projectId, request);
}

export async function getEpisodeDraft(episodeId: string, userId: string): Promise<EpisodeDraftResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_READ_ROLES);
  return editorCoreService.getEpisodeDraft(episodeId);
}

export async function updateEpisode(episodeId: string, request: PatchEpisodeRequest, userId: string): Promise<Episode> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.updateEpisode(episodeId, request);
}

export async function getLatestPublishedEpisode(episodeId: string, userId: string): Promise<Publish | null> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_READ_ROLES);
  return editorCoreService.getLatestPublishedEpisode(episodeId);
}

export async function getEpisodeTestViewerPublish(episodeId: string, userId: string): Promise<ProductPublish> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_READ_ROLES);
  return editorCoreService.getEpisodeTestViewerPublish(episodeId);
}

export async function createCut(episodeId: string, request: CreateCutRequest, userId: string): Promise<Cut> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.createCut(episodeId, request);
}

export async function reorderEpisodeCuts(
  episodeId: string,
  request: ReorderEpisodeCutsRequest,
  userId: string
): Promise<ReorderEpisodeCutsResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.reorderEpisodeCuts(episodeId, request);
}

export async function updateEpisodeCutLayout(
  episodeId: string,
  request: PatchEpisodeCutLayoutRequest,
  userId: string
): Promise<PatchEpisodeCutLayoutResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.updateEpisodeCutLayout(episodeId, request);
}

export async function createLoopStateSetting(
  episodeId: string,
  request: CreateLoopStateSettingRequest,
  userId: string
): Promise<CreateLoopStateSettingResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.createLoopStateSetting(episodeId, request);
}

export async function deleteLoopStateSetting(episodeId: string, groupId: string, userId: string): Promise<EpisodeDraftResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.deleteLoopStateSetting(episodeId, groupId);
}

export async function updateLoopStateSetting(
  episodeId: string,
  groupId: string,
  request: CreateLoopStateSettingRequest,
  userId: string
): Promise<CreateLoopStateSettingResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.updateLoopStateSetting(episodeId, groupId, request);
}

export async function updateCut(cutId: string, request: PatchCutRequest, userId: string): Promise<Cut> {
  await authorizationService.ensureCutProjectRole(cutId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.updateCut(cutId, request);
}

export async function deleteCut(cutId: string, userId: string, request: DeleteCutRequest = {}): Promise<void> {
  await authorizationService.ensureCutProjectRole(cutId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.deleteCut(cutId, request);
}

export async function createChoice(cutId: string, request: CreateChoiceRequest, userId: string): Promise<Choice> {
  await authorizationService.ensureCutProjectRole(cutId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.createChoice(cutId, request);
}

export async function updateChoice(choiceId: string, request: PatchChoiceRequest, userId: string): Promise<Choice> {
  await authorizationService.ensureChoiceProjectRole(choiceId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.updateChoice(choiceId, request);
}

export async function deleteChoice(choiceId: string, userId: string): Promise<void> {
  await authorizationService.ensureChoiceProjectRole(choiceId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.deleteChoice(choiceId);
}

export async function validateEpisode(episodeId: string, userId: string): Promise<ValidateEpisodeResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_WRITE_ROLES);
  return editorCoreService.validateEpisode(episodeId);
}
