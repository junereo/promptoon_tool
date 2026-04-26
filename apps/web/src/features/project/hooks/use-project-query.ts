import type { CreateEpisodeRequest, CreateProjectRequest, PatchEpisodeRequest } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { projectService } from '../../../shared/api/project.service';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function useProjects() {
  return useQuery({
    queryKey: promptoonKeys.projects(),
    queryFn: () => projectService.getProjects()
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => projectService.createProject(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}

export function useCreateEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: CreateEpisodeRequest }) =>
      projectService.createEpisode(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}

export function useUpdateEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ episodeId, payload }: { episodeId: string; payload: PatchEpisodeRequest }) =>
      projectService.patchEpisode(episodeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}
