import type { AnalyticsResetScope, AnalyticsViewGranularity, AnalyticsViewRange } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { promptoonKeys } from '../../../shared/api/query-keys';
import { studioApi } from '../../../shared/api/studio.api';

export function useEpisodeAnalytics(
  episodeId: string,
  viewsGranularity: AnalyticsViewGranularity = 'daily',
  viewsRange: AnalyticsViewRange = {}
) {
  return useQuery({
    queryKey: promptoonKeys.episodeAnalytics(episodeId, viewsGranularity, viewsRange),
    queryFn: () => studioApi.getEpisodeAnalytics(episodeId, viewsGranularity, viewsRange),
    enabled: Boolean(episodeId)
  });
}

export function useResetEpisodeAnalytics(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scope: AnalyticsResetScope) => studioApi.resetEpisodeAnalytics(episodeId, scope),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeAnalyticsRoot(episodeId) });
    }
  });
}
