import { useQuery } from '@tanstack/react-query';

import { viewerApi } from '../../../shared/api/viewer.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function usePublishedEpisode(publishId: string) {
  return useQuery({
    queryKey: promptoonKeys.publishedEpisode(publishId),
    queryFn: () => viewerApi.getPublishedEpisode(publishId),
    enabled: Boolean(publishId)
  });
}
