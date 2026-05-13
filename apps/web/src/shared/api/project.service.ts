import type {
  CreateEpisodeRequest,
  CreateProjectRequest,
  Episode,
  PatchEpisodeRequest,
  Project,
  ProjectWithEpisodes,
  PromptoonBackupExport
} from '@promptoon/shared';

import { studioApi } from './studio.api';

/** @deprecated Use studioApi for project and episode management. */
export const projectService = {
  async getProjects(): Promise<ProjectWithEpisodes[]> {
    return studioApi.getProjects();
  },

  async exportBackup(): Promise<PromptoonBackupExport> {
    return studioApi.exportBackup();
  },

  async createProject(payload: CreateProjectRequest): Promise<Project> {
    return studioApi.createProject(payload);
  },

  async createEpisode(projectId: string, payload: CreateEpisodeRequest): Promise<Episode> {
    return studioApi.createEpisode(projectId, payload);
  },

  async patchEpisode(episodeId: string, payload: PatchEpisodeRequest): Promise<Episode> {
    return studioApi.patchEpisode(episodeId, payload);
  }
};
