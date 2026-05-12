import type {
  AssetUploadResponse,
  CreateEpisodeRequest,
  CreateMovingtoonEpisodeRequest,
  CreateProjectRequest,
  PatchEpisodeRequest,
  PatchProjectRequest,
  PatchProjectMemberRequest,
  UpsertProjectMemberRequest
} from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { promptoonKeys } from '../../../shared/api/query-keys';
import { studioApi } from '../../../shared/api/studio.api';

export function useProjects() {
  return useQuery({
    queryKey: promptoonKeys.projects(),
    queryFn: () => studioApi.getProjects()
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => studioApi.createProject(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}

export function usePatchProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PatchProjectRequest) => studioApi.patchProject(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}

export function useProjectAssets(projectId?: string) {
  return useQuery({
    queryKey: promptoonKeys.projectAssets(projectId ?? ''),
    queryFn: () => studioApi.listProjectAssets(projectId ?? ''),
    enabled: Boolean(projectId)
  });
}

export function useUploadProjectAsset(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<AssetUploadResponse, Error, File>({
    mutationFn: (file) => studioApi.uploadAsset(projectId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projectAssets(projectId) });
    }
  });
}

export function useUploadQueue() {
  return useQuery({
    queryKey: promptoonKeys.uploadQueue(),
    queryFn: () => studioApi.listUploadQueue()
  });
}

export function useProjectPublishHistory(projectId?: string) {
  return useQuery({
    queryKey: promptoonKeys.projectPublishHistory(projectId ?? ''),
    queryFn: () => studioApi.listProjectPublishHistory(projectId ?? ''),
    enabled: Boolean(projectId)
  });
}

export function useExportBackup() {
  return useMutation({
    mutationFn: () => studioApi.exportBackup()
  });
}

export function useProjectMembers(projectId?: string) {
  return useQuery({
    queryKey: promptoonKeys.projectMembers(projectId ?? ''),
    queryFn: () => studioApi.listProjectMembers(projectId ?? ''),
    enabled: Boolean(projectId)
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertProjectMemberRequest) => studioApi.addProjectMember(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projectMembers(projectId) });
    }
  });
}

export function usePatchProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: PatchProjectMemberRequest }) =>
      studioApi.patchProjectMember(projectId, userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projectMembers(projectId) });
    }
  });
}

export function useDeleteProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => studioApi.deleteProjectMember(projectId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projectMembers(projectId) });
    }
  });
}

export function useCreateEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: CreateEpisodeRequest }) =>
      studioApi.createEpisode(projectId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}

export function useCreateMovingtoonEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: CreateMovingtoonEpisodeRequest & { file: File } }) =>
      studioApi.createMovingtoonEpisode(projectId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.uploadQueue() })
      ]);
    }
  });
}

export function usePublishMovingtoonEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (episodeId: string) => studioApi.publishMovingtoonEpisode(episodeId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}

export function useUnpublishMovingtoonEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (episodeId: string) => studioApi.unpublishMovingtoonEpisode(episodeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
    }
  });
}

export function useUpdateEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ episodeId, payload }: { episodeId: string; payload: PatchEpisodeRequest }) =>
      studioApi.patchEpisode(episodeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() });
    }
  });
}
