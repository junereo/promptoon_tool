import type {
  AssetUploadResponse,
  AnalyticsEpisodeResponse,
  AnalyticsResetScope,
  AnalyticsViewGranularity,
  AnalyticsViewRange,
  Choice,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateLoopStateSettingRequest,
  CreateLoopStateSettingResponse,
  Cut,
  DeleteCutRequest,
  EpisodeDraftResponse,
  FeedResponse,
  PatchChoiceRequest,
  PatchEpisodeCutLayoutRequest,
  PatchEpisodeCutLayoutResponse,
  PatchCutRequest,
  Publish,
  ReorderEpisodeCutsRequest,
  ReorderEpisodeCutsResponse,
  ResetEpisodeAnalyticsRequest,
  TelemetryEventRequest,
  ValidateEpisodeResponse
} from '@promptoon/shared';

import { feedApi } from './feed.api';
import { studioApi } from './studio.api';
import { telemetryApi } from './telemetry.api';
import { viewerApi } from './viewer.api';

/** @deprecated Use domain-specific API modules instead. */
export const promptoonService = {
  async getEpisodeDraft(episodeId: string): Promise<EpisodeDraftResponse> {
    return studioApi.getEpisodeDraft(episodeId);
  },

  async createCut(episodeId: string, payload: CreateCutRequest): Promise<Cut> {
    return studioApi.createCut(episodeId, payload);
  },

  async patchCut(cutId: string, payload: PatchCutRequest): Promise<Cut> {
    return studioApi.patchCut(cutId, payload);
  },

  async uploadAsset(projectId: string, file: File): Promise<AssetUploadResponse> {
    return studioApi.uploadAsset(projectId, file);
  },

  async deleteCut(cutId: string, payload?: DeleteCutRequest): Promise<void> {
    await studioApi.deleteCut(cutId, payload);
  },

  async createChoice(cutId: string, payload: CreateChoiceRequest): Promise<Choice> {
    return studioApi.createChoice(cutId, payload);
  },

  async patchChoice(choiceId: string, payload: PatchChoiceRequest): Promise<Choice> {
    return studioApi.patchChoice(choiceId, payload);
  },

  async deleteChoice(choiceId: string): Promise<void> {
    await studioApi.deleteChoice(choiceId);
  },

  async reorderCuts(episodeId: string, payload: ReorderEpisodeCutsRequest): Promise<ReorderEpisodeCutsResponse> {
    return studioApi.reorderCuts(episodeId, payload);
  },

  async patchCutLayout(episodeId: string, payload: PatchEpisodeCutLayoutRequest): Promise<PatchEpisodeCutLayoutResponse> {
    return studioApi.patchCutLayout(episodeId, payload);
  },

  async validateEpisode(episodeId: string): Promise<ValidateEpisodeResponse> {
    return studioApi.validateEpisode(episodeId);
  },

  async createLoopStateSetting(
    episodeId: string,
    payload: CreateLoopStateSettingRequest
  ): Promise<CreateLoopStateSettingResponse> {
    return studioApi.createLoopStateSetting(episodeId, payload);
  },

  async deleteLoopStateSetting(episodeId: string, groupId: string): Promise<EpisodeDraftResponse> {
    return studioApi.deleteLoopStateSetting(episodeId, groupId);
  },

  async updateLoopStateSetting(
    episodeId: string,
    groupId: string,
    payload: CreateLoopStateSettingRequest
  ): Promise<CreateLoopStateSettingResponse> {
    return studioApi.updateLoopStateSetting(episodeId, groupId, payload);
  },

  async publishEpisode(projectId: string, episodeId: string): Promise<Publish> {
    return studioApi.publishProject(projectId, episodeId);
  },

  async updatePublishedEpisode(projectId: string, episodeId: string): Promise<Publish> {
    return studioApi.updatePublishedProject(projectId, episodeId);
  },

  async unpublishEpisode(projectId: string, episodeId: string): Promise<void> {
    await studioApi.unpublishProject(projectId, episodeId);
  },

  async getPublishedEpisode(publishId: string): Promise<Publish> {
    return viewerApi.getPublishedEpisode(publishId);
  },

  async getFeed(cursor?: string, limit = 10): Promise<FeedResponse> {
    return feedApi.getMixedFeed({ cursor, limit });
  },

  async getLatestPublishedEpisode(episodeId: string): Promise<Publish | null> {
    return studioApi.getLatestPublishedEpisode(episodeId);
  },

  async trackViewerEvent(payload: TelemetryEventRequest): Promise<void> {
    await telemetryApi.trackViewerEvent(payload);
  },

  async getEpisodeAnalytics(
    episodeId: string,
    viewsGranularity: AnalyticsViewGranularity,
    viewsRange: AnalyticsViewRange = {}
  ): Promise<AnalyticsEpisodeResponse> {
    return studioApi.getEpisodeAnalytics(episodeId, viewsGranularity, viewsRange);
  },

  async resetEpisodeAnalytics(episodeId: string, scope: AnalyticsResetScope): Promise<void> {
    await studioApi.resetEpisodeAnalytics(episodeId, scope);
  }
};
