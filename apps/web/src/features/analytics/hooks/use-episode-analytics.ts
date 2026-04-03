import { useQuery } from '@tanstack/react-query';

import { promptoonService } from '../../../shared/api/promptoon.service';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function useEpisodeAnalytics(episodeId: string) {
  return useQuery({
    queryKey: promptoonKeys.episodeAnalytics(episodeId),
    queryFn: () => promptoonService.getEpisodeAnalytics(episodeId),
    enabled: Boolean(episodeId)
  });
}
