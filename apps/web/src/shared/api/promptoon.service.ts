import type {
  AssetUploadResponse,
  AnalyticsEpisodeResponse,
  Choice,
  CreateChoiceRequest,
  CreateCutRequest,
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
  TelemetryEventRequest,
  ValidateEpisodeResponse
} from '@promptoon/shared';

import { apiClient, publicApiClient } from './client';

export const promptoonService = {
  async getEpisodeDraft(episodeId: string): Promise<EpisodeDraftResponse> {
    const { data } = await apiClient.get(`/episodes/${episodeId}/draft`);
    return data;
  },

  async createCut(episodeId: string, payload: CreateCutRequest): Promise<Cut> {
    const { data } = await apiClient.post(`/episodes/${episodeId}/cuts`, payload);
    return data;
  },

  async patchCut(cutId: string, payload: PatchCutRequest): Promise<Cut> {
    const { data } = await apiClient.patch(`/cuts/${cutId}`, payload);
    return data;
  },

  async uploadAsset(projectId: string, file: File): Promise<AssetUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(`/projects/${projectId}/assets`, formData);
    return data;
  },

  async deleteCut(cutId: string, payload?: DeleteCutRequest): Promise<void> {
    await apiClient.delete(`/cuts/${cutId}`, payload ? { data: payload } : undefined);
  },

  async createChoice(cutId: string, payload: CreateChoiceRequest): Promise<Choice> {
    const { data } = await apiClient.post(`/cuts/${cutId}/choices`, payload);
    return data;
  },

  async patchChoice(choiceId: string, payload: PatchChoiceRequest): Promise<Choice> {
    const { data } = await apiClient.patch(`/choices/${choiceId}`, payload);
    return data;
  },

  async deleteChoice(choiceId: string): Promise<void> {
    await apiClient.delete(`/choices/${choiceId}`);
  },

  async reorderCuts(episodeId: string, payload: ReorderEpisodeCutsRequest): Promise<ReorderEpisodeCutsResponse> {
    const { data } = await apiClient.patch(`/episodes/${episodeId}/cuts/reorder`, payload);
    return data;
  },

  async patchCutLayout(episodeId: string, payload: PatchEpisodeCutLayoutRequest): Promise<PatchEpisodeCutLayoutResponse> {
    const { data } = await apiClient.patch(`/episodes/${episodeId}/cuts/layout`, payload);
    return data;
  },

  async validateEpisode(episodeId: string): Promise<ValidateEpisodeResponse> {
    const { data } = await apiClient.post(`/episodes/${episodeId}/validate`);
    return data;
  },

  async publishEpisode(projectId: string, episodeId: string): Promise<Publish> {
    const { data } = await apiClient.post(`/projects/${projectId}/publish`, { episodeId });
    return data;
  },

  async updatePublishedEpisode(projectId: string, episodeId: string): Promise<Publish> {
    const { data } = await apiClient.post(`/projects/${projectId}/publish/update`, { episodeId });
    return data;
  },

  async unpublishEpisode(projectId: string, episodeId: string): Promise<void> {
    await apiClient.post(`/projects/${projectId}/unpublish`, { episodeId });
  },

  async getPublishedEpisode(publishId: string): Promise<Publish> {
    const { data } = await publicApiClient.get(`/episodes/published/${publishId}`);
    return data;
  },

  async getFeed(cursor?: string, limit = 10): Promise<FeedResponse> {
    const { data } = await publicApiClient.get('/episodes/feed', {
      params: {
        cursor,
        limit
      }
    });
    return data;
  },

  async getLatestPublishedEpisode(episodeId: string): Promise<Publish | null> {
    const { data } = await apiClient.get(`/episodes/${episodeId}/published/latest`);
    return data;
  },

  async trackViewerEvent(payload: TelemetryEventRequest): Promise<void> {
    await publicApiClient.post('/telemetry/events', payload);
  },

  async getEpisodeAnalytics(episodeId: string): Promise<AnalyticsEpisodeResponse> {
    const { data } = await apiClient.get(`/analytics/episodes/${episodeId}`);
    return data;
  }
};
