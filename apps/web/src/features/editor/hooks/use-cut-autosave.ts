import type { EpisodeDraftResponse, PatchCutRequest } from '@promptoon/shared';
import { useQueryClient } from '@tanstack/react-query';

import { promptoonKeys } from '../../../shared/api/query-keys';
import { useEditorStore } from '../store/use-editor-store';
import { useUpdateCut } from './use-episode-query';

export function useCutAutosave(episodeId: string) {
  const queryClient = useQueryClient();
  const updateCut = useUpdateCut(episodeId);
  const markPendingCut = useEditorStore((state) => state.markPendingCut);
  const clearPendingCut = useEditorStore((state) => state.clearPendingCut);

  return {
    queueCutPatch(cutId: string, payload: PatchCutRequest) {
      const draft = queryClient.getQueryData<EpisodeDraftResponse>(promptoonKeys.episodeDraft(episodeId));
      const currentCut = draft?.cuts.find((cut) => cut.id === cutId);
      if (!currentCut) {
        return;
      }

      markPendingCut(cutId);
      updateCut.mutate(
        { cutId, payload },
        {
          onSettled: () => {
            clearPendingCut(cutId);
          }
        }
      );
    }
  };
}
