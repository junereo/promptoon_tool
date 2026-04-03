import { useQuery } from '@tanstack/react-query';

import { promptoonService } from '../../../shared/api/promptoon.service';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function usePublishedEpisode(publishId: string) {
  return useQuery({
    queryKey: promptoonKeys.publishedEpisode(publishId),
    queryFn: () => promptoonService.getPublishedEpisode(publishId),
    enabled: Boolean(publishId)
  });
}
