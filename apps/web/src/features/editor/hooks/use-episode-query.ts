import type {
  AssetUploadResponse,
  Choice,
  CreateChoiceRequest,
  CreateCutRequest,
  Cut,
  EpisodeDraftResponse,
  PatchChoiceRequest,
  PatchCutRequest,
  Publish,
  ReorderEpisodeCutsRequest,
  ReorderEpisodeCutsResponse,
  ValidateEpisodeResponse
} from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { promptoonService } from '../../../shared/api/promptoon.service';
import { promptoonKeys } from '../../../shared/api/query-keys';

function mergeCutPatch(cut: Cut, patch: PatchCutRequest): Cut {
  return {
    ...cut,
    ...patch,
    assetUrl: Object.prototype.hasOwnProperty.call(patch, 'assetUrl') ? patch.assetUrl ?? null : cut.assetUrl,
    isEnding: patch.isEnding !== undefined ? patch.isEnding : patch.kind === 'ending' ? true : cut.isEnding
  };
}

function mergeChoicePatch(choice: Choice, patch: PatchChoiceRequest): Choice {
  return {
    ...choice,
    ...patch,
    nextCutId: Object.prototype.hasOwnProperty.call(patch, 'nextCutId') ? patch.nextCutId ?? null : choice.nextCutId
  };
}

function replaceCut(draft: EpisodeDraftResponse | undefined, cut: Cut): EpisodeDraftResponse | undefined {
  if (!draft) {
    return draft;
  }

  const cuts = draft.cuts.map((existingCut) => (existingCut.id === cut.id ? cut : existingCut));
  const episode = cut.isStart
    ? { ...draft.episode, startCutId: cut.id }
    : draft.episode.startCutId === cut.id && !cut.isStart
      ? { ...draft.episode, startCutId: null }
      : draft.episode;

  return {
    ...draft,
    episode,
    cuts
  };
}

function replaceChoice(draft: EpisodeDraftResponse | undefined, choice: Choice): EpisodeDraftResponse | undefined {
  if (!draft) {
    return draft;
  }

  return {
    ...draft,
    choices: draft.choices.map((existingChoice) => (existingChoice.id === choice.id ? choice : existingChoice))
  };
}

function reorderCutsInDraft(
  draft: EpisodeDraftResponse | undefined,
  payload: ReorderEpisodeCutsRequest
): EpisodeDraftResponse | undefined {
  if (!draft) {
    return draft;
  }

  const orderIndexById = new Map(payload.cuts.map((cut) => [cut.cutId, cut.orderIndex]));
  const cuts = draft.cuts
    .map((cut) =>
      orderIndexById.has(cut.id)
        ? {
            ...cut,
            orderIndex: orderIndexById.get(cut.id) ?? cut.orderIndex
          }
        : cut
    )
    .sort((left: Cut, right: Cut) => left.orderIndex - right.orderIndex);

  return {
    ...draft,
    cuts
  };
}

function replaceCuts(draft: EpisodeDraftResponse | undefined, cuts: Cut[]): EpisodeDraftResponse | undefined {
  if (!draft) {
    return draft;
  }

  return {
    ...draft,
    cuts
  };
}

type UpdateCutVariables = {
  cutId: string;
  payload: PatchCutRequest;
  previousCut?: Cut;
};

type UpdateChoiceVariables = {
  choiceId: string;
  payload: PatchChoiceRequest;
  previousChoice?: Choice;
};

export function useEpisodeDraft(episodeId: string) {
  return useQuery({
    queryKey: promptoonKeys.episodeDraft(episodeId),
    queryFn: () => promptoonService.getEpisodeDraft(episodeId),
    enabled: Boolean(episodeId)
  });
}

export function useCreateCut(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCutRequest) => promptoonService.createCut(episodeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeDraft(episodeId) });
    }
  });
}

export function useDeleteCut(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cutId: string) => promptoonService.deleteCut(cutId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeDraft(episodeId) });
    }
  });
}

export function useUpdateCut(episodeId: string) {
  const queryClient = useQueryClient();
  const queryKey = promptoonKeys.episodeDraft(episodeId);

  return useMutation({
    mutationFn: ({ cutId, payload }: UpdateCutVariables) => promptoonService.patchCut(cutId, payload),
    onMutate: async ({ cutId, payload, previousCut }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDraft = previousCut ? undefined : queryClient.getQueryData<EpisodeDraftResponse>(queryKey);

      if (!previousCut) {
        queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => {
          const currentCut = draft?.cuts.find((cut) => cut.id === cutId);
          if (!draft || !currentCut) {
            return draft;
          }

          return replaceCut(draft, mergeCutPatch(currentCut, payload));
        });
      }

      return { previousDraft, previousCut };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCut) {
        queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => replaceCut(draft, context.previousCut!));
        return;
      }

      if (context?.previousDraft) {
        queryClient.setQueryData(queryKey, context.previousDraft);
      }
    },
    onSuccess: (updatedCut) => {
      queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => replaceCut(draft, updatedCut));
    }
  });
}

export function useUploadAsset() {
  return useMutation<AssetUploadResponse, Error, { projectId: string; file: File }>({
    mutationFn: ({ projectId, file }) => promptoonService.uploadAsset(projectId, file)
  });
}

export function useCreateChoice(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cutId, payload }: { cutId: string; payload: CreateChoiceRequest }) =>
      promptoonService.createChoice(cutId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeDraft(episodeId) });
    }
  });
}

export function useDeleteChoice(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choiceId: string) => promptoonService.deleteChoice(choiceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeDraft(episodeId) });
    }
  });
}

export function useUpdateChoice(episodeId: string) {
  const queryClient = useQueryClient();
  const queryKey = promptoonKeys.episodeDraft(episodeId);

  return useMutation({
    mutationFn: ({ choiceId, payload }: UpdateChoiceVariables) => promptoonService.patchChoice(choiceId, payload),
    onMutate: async ({ choiceId, payload, previousChoice }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDraft = previousChoice ? undefined : queryClient.getQueryData<EpisodeDraftResponse>(queryKey);

      if (!previousChoice) {
        queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => {
          const currentChoice = draft?.choices.find((choice) => choice.id === choiceId);
          if (!draft || !currentChoice) {
            return draft;
          }

          return replaceChoice(draft, mergeChoicePatch(currentChoice, payload));
        });
      }

      return { previousDraft, previousChoice };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousChoice) {
        queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) =>
          replaceChoice(draft, context.previousChoice!)
        );
        return;
      }

      if (context?.previousDraft) {
        queryClient.setQueryData(queryKey, context.previousDraft);
      }
    },
    onSuccess: (updatedChoice) => {
      queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => replaceChoice(draft, updatedChoice));
    }
  });
}

export function useReorderCuts(episodeId: string) {
  const queryClient = useQueryClient();
  const queryKey = promptoonKeys.episodeDraft(episodeId);

  return useMutation({
    mutationFn: (payload: ReorderEpisodeCutsRequest) => promptoonService.reorderCuts(episodeId, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDraft = queryClient.getQueryData<EpisodeDraftResponse>(queryKey);
      queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => reorderCutsInDraft(draft, payload));
      return { previousDraft };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDraft) {
        queryClient.setQueryData(queryKey, context.previousDraft);
      }
    },
    onSuccess: (response: ReorderEpisodeCutsResponse) => {
      queryClient.setQueryData<EpisodeDraftResponse | undefined>(queryKey, (draft) => replaceCuts(draft, response.cuts));
    }
  });
}

export function useValidateEpisode() {
  return useMutation<ValidateEpisodeResponse, Error, string>({
    mutationFn: (episodeId) => promptoonService.validateEpisode(episodeId)
  });
}

export function useLatestPublishedEpisode(episodeId: string) {
  return useQuery({
    queryKey: promptoonKeys.latestPublishedEpisode(episodeId),
    queryFn: () => promptoonService.getLatestPublishedEpisode(episodeId),
    enabled: Boolean(episodeId)
  });
}

export function usePublishEpisode() {
  const queryClient = useQueryClient();

  return useMutation<Publish, Error, { projectId: string; episodeId: string }>({
    mutationFn: ({ projectId, episodeId }) => promptoonService.publishEpisode(projectId, episodeId),
    onSuccess: async (_publish, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeDraft(variables.episodeId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.latestPublishedEpisode(variables.episodeId) })
      ]);
    }
  });
}

export function useUnpublishEpisode() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { projectId: string; episodeId: string }>({
    mutationFn: ({ projectId, episodeId }) => promptoonService.unpublishEpisode(projectId, episodeId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeDraft(variables.episodeId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.latestPublishedEpisode(variables.episodeId) })
      ]);
    }
  });
}
