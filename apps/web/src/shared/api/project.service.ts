import type { CreateEpisodeRequest, CreateProjectRequest, Episode, Project, ProjectWithEpisodes } from '@promptoon/shared';

import { apiClient } from './client';

export const projectService = {
  async getProjects(): Promise<ProjectWithEpisodes[]> {
    const { data } = await apiClient.get('/projects');
    return data;
  },

  async createProject(payload: CreateProjectRequest): Promise<Project> {
    const { data } = await apiClient.post('/projects', payload);
    return data;
  },

  async createEpisode(projectId: string, payload: CreateEpisodeRequest): Promise<Episode> {
    const { data } = await apiClient.post(`/projects/${projectId}/episodes`, payload);
    return data;
  }
};

