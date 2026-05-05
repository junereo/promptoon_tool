import { useInfiniteQuery } from '@tanstack/react-query';

import { feedApi } from '../../../shared/api/feed.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

const FEED_PAGE_SIZE = 10;

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: promptoonKeys.feed(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => feedApi.getMixedFeed({ cursor: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}
