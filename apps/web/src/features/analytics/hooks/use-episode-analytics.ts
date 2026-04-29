import type { AnalyticsResetScope, AnalyticsViewGranularity, AnalyticsViewRange } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { promptoonService } from '../../../shared/api/promptoon.service';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function useEpisodeAnalytics(
  episodeId: string,
  viewsGranularity: AnalyticsViewGranularity = 'daily',
  viewsRange: AnalyticsViewRange = {}
) {
  return useQuery({
    queryKey: promptoonKeys.episodeAnalytics(episodeId, viewsGranularity, viewsRange),
    queryFn: () => promptoonService.getEpisodeAnalytics(episodeId, viewsGranularity, viewsRange),
    enabled: Boolean(episodeId)
  });
}

export function useResetEpisodeAnalytics(episodeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scope: AnalyticsResetScope) => promptoonService.resetEpisodeAnalytics(episodeId, scope),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.episodeAnalyticsRoot(episodeId) });
    }
  });
}
