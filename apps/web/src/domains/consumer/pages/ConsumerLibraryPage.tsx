import type { FeedItem } from '@promptoon/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'react-coolicons';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { feedApi } from '../../../shared/api/feed.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { ConsumerContentCard } from '../components/ConsumerContentCard';
import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';

const LIBRARY_PAGE_SIZE = 12;

function flattenFeedItems(pages: Array<{ items: FeedItem[] }> | undefined): FeedItem[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

function LibraryHeader() {
  return (
    <header className="px-5 pb-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <p className="text-xs font-semibold uppercase text-white/42">Library</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal">보관함</h1>
      <p className="mt-2 text-sm leading-6 text-white/58">저장한 프롬툰, 웹툰, 숏드라마를 한곳에서 다시 볼 수 있습니다.</p>
    </header>
  );
}

export function ConsumerLibraryPage() {
  const queryClient = useQueryClient();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const bookmarksQuery = useInfiniteQuery({
    enabled: hasHydrated && isAuthenticated,
    queryKey: promptoonKeys.feedBookmarks(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      feedApi.getBookmarks({
        cursor: pageParam,
        limit: LIBRARY_PAGE_SIZE
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
  const unbookmarkMutation = useMutation({
    mutationFn: (publishId: string) => feedApi.unbookmarkPublish(publishId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feedBookmarks() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feedInteractionStateRoot() })
      ]);
    }
  });
  const items = useMemo(() => flattenFeedItems(bookmarksQuery.data?.pages), [bookmarksQuery.data?.pages]);

  if (!hasHydrated) {
    return (
      <ConsumerResponsiveFrame>
        <p className="px-5 py-16 text-sm text-white/56">인증 상태를 확인하고 있습니다.</p>
      </ConsumerResponsiveFrame>
    );
  }

  if (!isAuthenticated) {
    return (
      <ConsumerResponsiveFrame>
        <LibraryHeader />
        <section className="px-5 pb-8">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-10 text-center">
            <Bookmark aria-hidden className="mx-auto h-10 w-10 text-white/36" />
            <p className="mt-4 text-sm font-semibold text-white">로그인하고 보관함을 확인하세요.</p>
            <p className="mt-2 text-sm leading-6 text-white/52">저장한 콘텐츠와 이어보기 목록을 한곳에서 관리할 수 있습니다.</p>
            <Link className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-4 text-sm font-bold text-zinc-950" to="/login">
              로그인
            </Link>
          </div>
        </section>
      </ConsumerResponsiveFrame>
    );
  }

  return (
    <ConsumerResponsiveFrame>
      <LibraryHeader />

      <section className="px-5 pb-6">
        {bookmarksQuery.isLoading ? <p className="py-10 text-sm text-white/56">보관함을 불러오는 중입니다.</p> : null}
        {bookmarksQuery.isError ? <p className="py-10 text-sm text-white/56">보관함을 불러오지 못했습니다.</p> : null}
        {!bookmarksQuery.isLoading && items.length === 0 ? (
          <div className="py-16 text-center">
            <Bookmark aria-hidden className="mx-auto h-10 w-10 text-white/36" />
            <p className="mt-4 text-sm font-semibold text-white">저장한 콘텐츠가 없습니다.</p>
            <p className="mt-2 text-sm leading-6 text-white/52">피드나 작품 상세에서 저장하면 여기에 모입니다.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-3 gap-y-6">
          {items.map((item) => (
            <div className="min-w-0" key={item.publishId}>
              <ConsumerContentCard item={item} />
              <button
                className="mt-2 h-9 w-full rounded-md border border-white/12 text-xs font-semibold text-white/68 transition hover:bg-white/8 hover:text-white disabled:opacity-50"
                disabled={unbookmarkMutation.isPending && unbookmarkMutation.variables === item.publishId}
                onClick={() => unbookmarkMutation.mutate(item.publishId)}
                type="button"
              >
                저장 해제
              </button>
            </div>
          ))}
        </div>

        {bookmarksQuery.hasNextPage ? (
          <button
            className="mt-7 h-11 w-full rounded-md border border-white/12 bg-white/8 text-sm font-semibold text-white/82"
            disabled={bookmarksQuery.isFetchingNextPage}
            onClick={() => {
              void bookmarksQuery.fetchNextPage();
            }}
            type="button"
          >
            {bookmarksQuery.isFetchingNextPage ? '불러오는 중' : '더 보기'}
          </button>
        ) : null}
      </section>
    </ConsumerResponsiveFrame>
  );
}
