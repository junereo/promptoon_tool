import { useQuery } from '@tanstack/react-query';

import { promptoonKeys } from '../../../shared/api/query-keys';
import { studioApi } from '../../../shared/api/studio.api';

export function useProjectAnalytics(projectId?: string) {
  return useQuery({
    queryKey: promptoonKeys.projectAnalytics(projectId ?? ''),
    queryFn: () => studioApi.getProjectAnalytics(projectId ?? ''),
    enabled: Boolean(projectId)
  });
}
