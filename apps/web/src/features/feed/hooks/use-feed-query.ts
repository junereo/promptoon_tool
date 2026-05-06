import { useInfiniteQuery } from '@tanstack/react-query';

import { feedApi } from '../../../shared/api/feed.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

const FEED_PAGE_SIZE = 10;

export type FeedSource = 'mixed' | 'episodes' | 'shorts';

const feedFetchers: Record<FeedSource, typeof feedApi.getMixedFeed> = {
  mixed: feedApi.getMixedFeed,
  episodes: feedApi.getEpisodes,
  shorts: feedApi.getShorts
};

export function useFeedQuery(source: FeedSource = 'mixed') {
  return useInfiniteQuery({
    queryKey: [...promptoonKeys.feed(), source] as const,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => feedFetchers[source]({ cursor: pageParam, limit: FEED_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}
