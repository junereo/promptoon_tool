import { useInfiniteQuery } from '@tanstack/react-query';

import { promptoonService } from '../../../shared/api/promptoon.service';
import { promptoonKeys } from '../../../shared/api/query-keys';

const FEED_PAGE_SIZE = 10;

export function useFeedQuery() {
  return useInfiniteQuery({
    queryKey: promptoonKeys.feed(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => promptoonService.getFeed(pageParam, FEED_PAGE_SIZE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}
