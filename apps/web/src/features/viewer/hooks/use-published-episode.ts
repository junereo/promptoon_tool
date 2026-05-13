import { useQuery } from '@tanstack/react-query';

import { studioApi } from '../../../shared/api/studio.api';
import { viewerApi } from '../../../shared/api/viewer.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

type ViewerQueryOptions = {
  enabled?: boolean;
};

export function usePublishedEpisode(publishId: string, options: ViewerQueryOptions = {}) {
  return useQuery({
    queryKey: promptoonKeys.publishedEpisode(publishId),
    queryFn: () => viewerApi.getPublishedEpisode(publishId),
    enabled: Boolean(publishId) && (options.enabled ?? true)
  });
}

export function useTestViewerEpisode(episodeId: string, options: ViewerQueryOptions = {}) {
  return useQuery({
    queryKey: promptoonKeys.episodeTestViewer(episodeId),
    queryFn: () => studioApi.getEpisodeTestViewer(episodeId),
    enabled: Boolean(episodeId) && (options.enabled ?? true)
  });
}
