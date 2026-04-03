import type { EpisodeDraftResponse, PatchChoiceRequest } from '@promptoon/shared';
import { useQueryClient } from '@tanstack/react-query';


import { promptoonKeys } from '../../../shared/api/query-keys';
import { useEditorStore } from '../store/use-editor-store';
import { useUpdateChoice } from './use-episode-query';

export function useChoiceAutosave(episodeId: string) {
  const queryClient = useQueryClient();
  const updateChoice = useUpdateChoice(episodeId);
  const markPendingChoice = useEditorStore((state) => state.markPendingChoice);
  const clearPendingChoice = useEditorStore((state) => state.clearPendingChoice);

  return {
    queueChoicePatch(choiceId: string, payload: PatchChoiceRequest) {
      const draft = queryClient.getQueryData<EpisodeDraftResponse>(promptoonKeys.episodeDraft(episodeId));
      const currentChoice = draft?.choices.find((choice) => choice.id === choiceId);
      if (!currentChoice) {
        return;
      }

      markPendingChoice(choiceId);
      updateChoice.mutate(
        { choiceId, payload },
        {
          onSettled: () => {
            clearPendingChoice(choiceId);
          }
        }
      );
    }
  };
}
