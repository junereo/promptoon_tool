import type {
  AnalyticsEpisodeResponse,
  AnalyticsResetScope,
  AnalyticsViewGranularity,
  AnalyticsViewRange,
  AssetUploadResponse,
  Choice,
  CreateEpisodeRequest,
  CreateMovingtoonEpisodeRequest,
  CreateMovingtoonEpisodeResponse,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateLoopStateSettingRequest,
  CreateLoopStateSettingResponse,
  CreateProjectRequest,
  Cut,
  DeleteCutRequest,
  Episode,
  EpisodeDraftResponse,
  PatchChoiceRequest,
  PatchCutRequest,
  PatchEpisodeRequest,
  PatchEpisodeCutLayoutRequest,
  PatchEpisodeCutLayoutResponse,
  PatchProjectRequest,
  PatchProjectMemberRequest,
  ProjectAssetListResponse,
  ProjectAnalyticsResponse,
  ProductPublish,
  Publish,
  Project,
  ProjectMemberListResponse,
  ProjectPublishHistoryResponse,
  ProjectWithEpisodes,
  PromptoonBackupExport,
  RebuildPublicProjectionsResponse,
  ReorderEpisodeCutsRequest,
  ReorderEpisodeCutsResponse,
  ResetEpisodeAnalyticsRequest,
  MovingtoonEpisodeSummary,
  MovingtoonProcessingJobSummary,
  UpsertProjectMemberRequest,
  ValidateEpisodeResponse
} from '@promptoon/shared';

import { rootApiClient } from './client';

export const studioApi = {
  async getProjects(): Promise<ProjectWithEpisodes[]> {
    const { data } = await rootApiClient.get('/studio/projects');
    return data;
  },

  async exportBackup(): Promise<PromptoonBackupExport> {
    const { data } = await rootApiClient.get('/studio/backup/export');
    return data;
  },

  async createProject(payload: CreateProjectRequest): Promise<Project> {
    const { data } = await rootApiClient.post('/studio/projects', payload);
    return data;
  },

  async patchProject(projectId: string, payload: PatchProjectRequest): Promise<Project> {
    const { data } = await rootApiClient.patch(`/studio/projects/${projectId}`, payload);
    return data;
  },

  async listProjectAssets(projectId: string): Promise<ProjectAssetListResponse> {
    const { data } = await rootApiClient.get(`/studio/projects/${projectId}/assets`);
    return data;
  },

  async listProjectPublishHistory(projectId: string): Promise<ProjectPublishHistoryResponse> {
    const { data } = await rootApiClient.get(`/studio/projects/${projectId}/publishes`);
    return data;
  },

  async createEpisode(projectId: string, payload: CreateEpisodeRequest): Promise<Episode> {
    const { data } = await rootApiClient.post(`/studio/projects/${projectId}/episodes`, payload);
    return data;
  },

  async createMovingtoonEpisode(
    projectId: string,
    payload: CreateMovingtoonEpisodeRequest & { file: File }
  ): Promise<CreateMovingtoonEpisodeResponse> {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('title', payload.title);
    formData.append('episodeNumber', String(payload.episodeNumber));
    formData.append('aspectRatio', payload.aspectRatio);
    if (payload.description) {
      formData.append('description', payload.description);
    }

    const { data } = await rootApiClient.post(`/studio/projects/${projectId}/movingtoon/episodes`, formData);
    return data;
  },

  async listUploadQueue(): Promise<{ jobs: MovingtoonProcessingJobSummary[] }> {
    const { data } = await rootApiClient.get('/studio/uploads');
    return data;
  },

  async reprocessMovingtoonEpisode(episodeId: string): Promise<MovingtoonProcessingJobSummary> {
    const { data } = await rootApiClient.post(`/studio/movingtoon/episodes/${episodeId}/reprocess`);
    return data;
  },

  async publishMovingtoonEpisode(episodeId: string): Promise<MovingtoonEpisodeSummary> {
    const { data } = await rootApiClient.post(`/studio/movingtoon/episodes/${episodeId}/publish`);
    return data;
  },

  async unpublishMovingtoonEpisode(episodeId: string): Promise<void> {
    await rootApiClient.post(`/studio/movingtoon/episodes/${episodeId}/unpublish`);
  },

  async patchEpisode(episodeId: string, payload: PatchEpisodeRequest): Promise<Episode> {
    const { data } = await rootApiClient.patch(`/studio/episodes/${episodeId}`, payload);
    return data;
  },

  async getEpisodeDraft(episodeId: string): Promise<EpisodeDraftResponse> {
    const { data } = await rootApiClient.get(`/studio/episodes/${episodeId}/draft`);
    return data;
  },

  async createCut(episodeId: string, payload: CreateCutRequest): Promise<Cut> {
    const { data } = await rootApiClient.post(`/studio/episodes/${episodeId}/cuts`, payload);
    return data;
  },

  async patchCut(cutId: string, payload: PatchCutRequest): Promise<Cut> {
    const { data } = await rootApiClient.patch(`/studio/cuts/${cutId}`, payload);
    return data;
  },

  async uploadAsset(projectId: string, file: File): Promise<AssetUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await rootApiClient.post(`/studio/projects/${projectId}/assets`, formData);
    return data;
  },

  async deleteCut(cutId: string, payload?: DeleteCutRequest): Promise<void> {
    await rootApiClient.delete(`/studio/cuts/${cutId}`, payload ? { data: payload } : undefined);
  },

  async createChoice(cutId: string, payload: CreateChoiceRequest): Promise<Choice> {
    const { data } = await rootApiClient.post(`/studio/cuts/${cutId}/choices`, payload);
    return data;
  },

  async patchChoice(choiceId: string, payload: PatchChoiceRequest): Promise<Choice> {
    const { data } = await rootApiClient.patch(`/studio/choices/${choiceId}`, payload);
    return data;
  },

  async deleteChoice(choiceId: string): Promise<void> {
    await rootApiClient.delete(`/studio/choices/${choiceId}`);
  },

  async reorderCuts(episodeId: string, payload: ReorderEpisodeCutsRequest): Promise<ReorderEpisodeCutsResponse> {
    const { data } = await rootApiClient.patch(`/studio/episodes/${episodeId}/cuts/reorder`, payload);
    return data;
  },

  async patchCutLayout(episodeId: string, payload: PatchEpisodeCutLayoutRequest): Promise<PatchEpisodeCutLayoutResponse> {
    const { data } = await rootApiClient.patch(`/studio/episodes/${episodeId}/cuts/layout`, payload);
    return data;
  },

  async validateEpisode(episodeId: string): Promise<ValidateEpisodeResponse> {
    const { data } = await rootApiClient.post(`/studio/episodes/${episodeId}/validate`);
    return data;
  },

  async createLoopStateSetting(
    episodeId: string,
    payload: CreateLoopStateSettingRequest
  ): Promise<CreateLoopStateSettingResponse> {
    const { data } = await rootApiClient.post(`/studio/episodes/${episodeId}/loop-state-setting`, payload);
    return data;
  },

  async deleteLoopStateSetting(episodeId: string, groupId: string): Promise<EpisodeDraftResponse> {
    const { data } = await rootApiClient.delete(`/studio/episodes/${episodeId}/loop-state-setting/${encodeURIComponent(groupId)}`);
    return data;
  },

  async updateLoopStateSetting(
    episodeId: string,
    groupId: string,
    payload: CreateLoopStateSettingRequest
  ): Promise<CreateLoopStateSettingResponse> {
    const { data } = await rootApiClient.patch(`/studio/episodes/${episodeId}/loop-state-setting/${encodeURIComponent(groupId)}`, payload);
    return data;
  },

  async publishProject(projectId: string, episodeId: string): Promise<Publish> {
    const { data } = await rootApiClient.post(`/studio/projects/${projectId}/publish`, { episodeId });
    return data;
  },

  async updatePublishedProject(projectId: string, episodeId: string): Promise<Publish> {
    const { data } = await rootApiClient.post(`/studio/projects/${projectId}/publish/update`, { episodeId });
    return data;
  },

  async unpublishProject(projectId: string, episodeId: string): Promise<void> {
    await rootApiClient.post(`/studio/projects/${projectId}/unpublish`, { episodeId });
  },

  async getLatestPublishedEpisode(episodeId: string): Promise<Publish | null> {
    const { data } = await rootApiClient.get(`/studio/episodes/${episodeId}/published/latest`);
    return data;
  },

  async getEpisodeTestViewer(episodeId: string): Promise<ProductPublish> {
    const { data } = await rootApiClient.get(`/studio/episodes/${episodeId}/test-viewer`);
    return data;
  },

  async getEpisodeAnalytics(
    episodeId: string,
    viewsGranularity: AnalyticsViewGranularity,
    viewsRange: AnalyticsViewRange = {}
  ): Promise<AnalyticsEpisodeResponse> {
    const { data } = await rootApiClient.get(`/studio/analytics/episodes/${episodeId}`, {
      params: {
        viewsGranularity,
        viewsFrom: viewsRange.from,
        viewsTo: viewsRange.to
      }
    });
    return data;
  },

  async getProjectAnalytics(projectId: string): Promise<ProjectAnalyticsResponse> {
    const { data } = await rootApiClient.get(`/studio/analytics/projects/${projectId}`);
    return data;
  },

  async resetEpisodeAnalytics(episodeId: string, scope: AnalyticsResetScope): Promise<void> {
    const payload: ResetEpisodeAnalyticsRequest = { scope };
    await rootApiClient.post(`/studio/analytics/episodes/${episodeId}/reset`, payload);
  },

  async rebuildPublicProjections(): Promise<RebuildPublicProjectionsResponse> {
    const { data } = await rootApiClient.post('/studio/projections/rebuild');
    return data;
  },

  async listProjectMembers(projectId: string): Promise<ProjectMemberListResponse> {
    const { data } = await rootApiClient.get(`/studio/projects/${projectId}/members`);
    return data;
  },

  async addProjectMember(projectId: string, payload: UpsertProjectMemberRequest): Promise<ProjectMemberListResponse> {
    const { data } = await rootApiClient.post(`/studio/projects/${projectId}/members`, payload);
    return data;
  },

  async patchProjectMember(
    projectId: string,
    userId: string,
    payload: PatchProjectMemberRequest
  ): Promise<ProjectMemberListResponse> {
    const { data } = await rootApiClient.patch(`/studio/projects/${projectId}/members/${userId}`, payload);
    return data;
  },

  async deleteProjectMember(projectId: string, userId: string): Promise<ProjectMemberListResponse> {
    const { data } = await rootApiClient.delete(`/studio/projects/${projectId}/members/${userId}`);
    return data;
  }
};
