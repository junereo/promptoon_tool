import type { FeedItem } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  MoreVertical as EllipsisVertical,
  HamburgerMd as Menu,
  AddPlus as Plus,
  SearchMagnifyingGlass as Search,
  UserCircle,
  CloseMd as X
} from 'react-coolicons';
import type { FormEvent } from 'react';
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { useFeedQuery, type FeedSource } from '../../../features/feed/hooks/use-feed-query';
import { useFeedTelemetry } from '../../../features/feed/hooks/use-feed-telemetry';
import { preloadViewerForPublish } from '../../../features/viewer/lib/preload-viewer';
import { communityApi } from '../../../shared/api/community.api';
import { feedApi } from '../../../shared/api/feed.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { FeedBottomNav } from '../components/FeedBottomNav';
import { FeedCommentsPanel } from '../components/FeedCommentsPanel';
import { FeedDiscourseCommentsPanel } from '../components/FeedDiscourseCommentsPanel';
import { FeedSlide } from '../components/FeedSlide';

type FeedTabKey = 'recommended' | 'following' | 'latest';

const FEED_TABS: Array<{ key: FeedTabKey; label: string; source: FeedSource }> = [
  { key: 'recommended', label: '추천', source: 'mixed' },
  { key: 'following', label: '팔로잉', source: 'mixed' },
  { key: 'latest', label: '최신', source: 'episodes' }
];

const FEED_MENU_DESCRIPTIONS = [
  { title: '추천', body: '반응과 공개 상태를 기준으로 지금 보기 좋은 콘텐츠를 보여줍니다.' },
  { title: '팔로잉', body: '구독하거나 팔로우한 채널의 새 콘텐츠를 모아 보여줍니다.' },
  { title: '최신', body: '최근 공개된 에피소드와 시리즈를 시간순으로 보여줍니다.' },
  { title: '검색', body: '채널, 시리즈, 에피소드를 탐색하는 화면으로 이동합니다.' }
];

const VIEWER_NAVIGATION_DELAY_MS = 120;
const SIDE_PANEL_REVEAL_DELAY_MS = 200;

function getUserInitial(loginId: string | null | undefined) {
  return loginId?.trim().slice(0, 1).toUpperCase() || 'MY';
}

function flattenFeedItems(pages: Array<{ items: FeedItem[] }> | undefined) {
  if (!pages) {
    return [];
  }

  return pages.flatMap((page) => page.items);
}

export function FeedHomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewedPublishIdsRef = useRef(new Set<string>());
  const preloadedAssetUrlsRef = useRef(new Set<string>());
  const activeIndexRef = useRef(0);
  const lastFeedScrollTopRef = useRef(0);
  const sidePanelRevealTimerRef = useRef<number | null>(null);
  const [activeTab] = useState<FeedTabKey>('recommended');
  const [activeIndex, setActiveIndex] = useState(0);
  const [openingPublishId, setOpeningPublishId] = useState<string | null>(null);
  const [isFeedMenuOpen, setIsFeedMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [visibleSidePanelIndex, setVisibleSidePanelIndex] = useState<number | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const feedSource = FEED_TABS.find((tab) => tab.key === activeTab)?.source ?? 'mixed';
  const feedQuery = useFeedQuery(feedSource);
  const telemetry = useFeedTelemetry();
  const feedItems = useMemo(() => flattenFeedItems(feedQuery.data?.pages), [feedQuery.data?.pages]);
  const publishIds = useMemo(() => feedItems.map((item) => item.publishId), [feedItems]);
  const publishIdsKey = publishIds.join(',');
  const interactionQuery = useQuery({
    enabled: isAuthenticated && publishIds.length > 0,
    queryKey: promptoonKeys.feedInteractionState(publishIdsKey),
    queryFn: () => feedApi.getInteractionState(publishIds)
  });
  const interactionByPublishId = useMemo(
    () => new Map((interactionQuery.data?.items ?? []).map((item) => [item.publishId, item])),
    [interactionQuery.data?.items]
  );
  const userInitial = useMemo(() => getUserInitial(user?.loginId), [user?.loginId]);
  const deferredActiveIndex = useDeferredValue(activeIndex);
  const activeItem = feedItems[deferredActiveIndex] ?? null;
  const activePublishId = activeItem?.publishId ?? null;
  const activeItemUsesDiscourse = activeItem?.type !== 'short_drama';
  const commentsPanelItem = feedItems[activeIndex] ?? activeItem;
  const hasCommentsPanelItem = Boolean(commentsPanelItem);
  const discourseInteractionViewerKey = isAuthenticated ? user?.id ?? user?.loginId ?? 'authenticated' : 'public';
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feedQuery;
  const discourseInteractionQuery = useQuery({
    enabled: Boolean(activePublishId) && activeItemUsesDiscourse,
    queryKey: activePublishId
      ? promptoonKeys.communityDiscourseInteraction(activePublishId, discourseInteractionViewerKey)
      : promptoonKeys.communityDiscourseInteraction('__idle__', discourseInteractionViewerKey),
    queryFn: () => communityApi.getDiscourseInteraction(activePublishId ?? '')
  });
  const discourseLikeMutation = useMutation({
    mutationFn: (input: { publishId: string; liked: boolean }) =>
      input.liked ? communityApi.unlikeDiscoursePublish(input.publishId) : communityApi.likeDiscoursePublish(input.publishId),
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(
        promptoonKeys.communityDiscourseInteraction(variables.publishId, discourseInteractionViewerKey),
        data
      );
      await queryClient.invalidateQueries({
        queryKey: promptoonKeys.communityDiscourseInteractionRoot(variables.publishId)
      });
    }
  });
  const bookmarkMutation = useMutation({
    mutationFn: (input: { item: FeedItem; bookmarked: boolean }) =>
      input.bookmarked
        ? feedApi.unbookmarkPublish(input.item.publishId, input.item.recommendation)
        : feedApi.bookmarkPublish(input.item.publishId, input.item.recommendation),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.feedInteractionState(publishIdsKey) });
    }
  });
  const feedLikeMutation = useMutation({
    mutationFn: (input: { item: FeedItem; liked: boolean }) =>
      input.liked
        ? feedApi.unlikePublish(input.item.publishId, input.item.recommendation)
        : feedApi.likePublish(input.item.publishId, input.item.recommendation),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.feedInteractionState(publishIdsKey) });
    }
  });

  useEffect(() => {
    setActiveIndex(0);
    setIsCommentsPanelOpen(false);
    containerRef.current?.scrollTo({ top: 0 });
    lastFeedScrollTopRef.current = 0;
    hideSidePanels();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      clearSidePanelRevealTimer();
    };
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (isCommentsPanelOpen && !hasCommentsPanelItem) {
      setIsCommentsPanelOpen(false);
    }
  }, [hasCommentsPanelItem, isCommentsPanelOpen]);

  useEffect(() => {
    if (!isFeedMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFeedMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFeedMenuOpen]);

  useEffect(() => {
    if (feedQuery.isLoading || feedQuery.isError || feedItems.length === 0) {
      hideSidePanels();
      return;
    }

    scheduleSidePanelReveal(activeIndex);
  }, [activeIndex, activeTab, feedItems.length, feedQuery.isError, feedQuery.isLoading]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let nextIndex = -1;
        let nextRatio = 0;

        for (const entry of entries) {
          if (entry.intersectionRatio < 0.75) {
            continue;
          }

          const rawIndex = Number((entry.target as HTMLElement).dataset.feedIndex);
          if (Number.isNaN(rawIndex) || entry.intersectionRatio <= nextRatio) {
            continue;
          }

          nextIndex = rawIndex;
          nextRatio = entry.intersectionRatio;
        }

        if (nextIndex >= 0) {
          startTransition(() => {
            setActiveIndex(nextIndex);
          });
        }
      },
      {
        root: container,
        threshold: [0.75, 0.9, 1]
      }
    );

    const slides = Array.from(container.querySelectorAll<HTMLElement>('[data-feed-slide]'));
    for (const [index, slide] of slides.entries()) {
      slide.dataset.feedIndex = String(index);
      observer.observe(slide);
    }

    return () => {
      observer.disconnect();
    };
  }, [feedItems.length, activeTab]);

  useEffect(() => {
    if (!activeItem || viewedPublishIdsRef.current.has(activeItem.publishId)) {
      return;
    }

    viewedPublishIdsRef.current.add(activeItem.publishId);
    telemetry.trackImpression(activeItem, deferredActiveIndex + 1);
  }, [activeItem, deferredActiveIndex, telemetry]);

  useEffect(() => {
    const preloadTargets = feedItems
      .slice(deferredActiveIndex + 1, deferredActiveIndex + 3)
      .map((item) => item.coverImageUrl ?? item.startCut.assetUrl)
      .filter((assetUrl): assetUrl is string => Boolean(assetUrl));

    for (const assetUrl of preloadTargets) {
      if (preloadedAssetUrlsRef.current.has(assetUrl)) {
        continue;
      }

      preloadedAssetUrlsRef.current.add(assetUrl);
      const image = new Image();
      image.src = assetUrl;
    }
  }, [deferredActiveIndex, feedItems]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || feedItems.length - deferredActiveIndex > 3) {
      return;
    }

    void fetchNextPage();
  }, [deferredActiveIndex, feedItems.length, fetchNextPage, hasNextPage, isFetchingNextPage]);

  function redirectToLogin() {
    navigate('/login', {
      state: {
        from: `${location.pathname}${location.search}`
      }
    });
  }

  function handlePreloadFeedItem(item: FeedItem) {
    if (item.type === 'short_drama') {
      return;
    }
    void preloadViewerForPublish(item.publishId).catch(() => undefined);
  }

  async function handleOpenFeedItem(item: FeedItem) {
    if (openingPublishId) {
      return;
    }

    setOpeningPublishId(item.publishId);

    if (item.type === 'short_drama') {
      navigate(item.entry?.href ?? `/shorts/${item.publishId}`);
      setOpeningPublishId(null);
      return;
    }

    try {
      await preloadViewerForPublish(item.publishId);
    } catch {
      // Navigation still falls back to the viewer's own loading state.
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, VIEWER_NAVIGATION_DELAY_MS);
    });

    navigate(`/v/${item.publishId}`);
  }

  function handleLikeFeedItem(item: FeedItem) {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    if (item.type === 'short_drama') {
      const interactionState = interactionByPublishId.get(item.publishId);
      void feedLikeMutation.mutateAsync({
        item,
        liked: interactionState?.liked ?? false
      }).catch(() => undefined);
      return;
    }

    const discourseInteraction = queryClient.getQueryData<Awaited<ReturnType<typeof communityApi.getDiscourseInteraction>>>(
      promptoonKeys.communityDiscourseInteraction(item.publishId, discourseInteractionViewerKey)
    );
    void discourseLikeMutation.mutateAsync({
      publishId: item.publishId,
      liked: discourseInteraction?.liked ?? false
    }).catch(() => undefined);
  }

  function handleBookmarkFeedItem(item: FeedItem) {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    const interactionState = interactionByPublishId.get(item.publishId);
    void bookmarkMutation.mutateAsync({
      item,
      bookmarked: interactionState?.bookmarked ?? false
    }).catch(() => undefined);
  }

  function handleCommentFeedItem() {
    setIsCommentsPanelOpen(true);
  }

  function handleCommentCreated() {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: promptoonKeys.feedInteractionState(publishIdsKey) }),
      queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() }),
      commentsPanelItem
        ? queryClient.invalidateQueries({ queryKey: promptoonKeys.communityDiscourseInteractionRoot(commentsPanelItem.publishId) })
        : Promise.resolve()
    ]).catch(() => undefined);
  }

  async function handleShareFeedItem(item: FeedItem) {
    const href = item.entry?.href ?? `/v/${item.publishId}`;
    const shareUrl = `${window.location.origin}${href}`;

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: item.episodeTitle,
          text: item.projectTitle,
          url: shareUrl
        });
        return;
      }

      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      // Sharing support differs by browser and should not block browsing.
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();

    navigate(query ? `/discovery?q=${encodeURIComponent(query)}` : '/discovery');
  }

  function clearSidePanelRevealTimer() {
    if (!sidePanelRevealTimerRef.current) {
      return;
    }

    window.clearTimeout(sidePanelRevealTimerRef.current);
    sidePanelRevealTimerRef.current = null;
  }

  function hideSidePanels() {
    clearSidePanelRevealTimer();
    setVisibleSidePanelIndex(null);
  }

  function scheduleSidePanelReveal(nextIndex: number) {
    clearSidePanelRevealTimer();
    setVisibleSidePanelIndex(null);
    sidePanelRevealTimerRef.current = window.setTimeout(() => {
      setVisibleSidePanelIndex(nextIndex);
      sidePanelRevealTimerRef.current = null;
    }, SIDE_PANEL_REVEAL_DELAY_MS);
  }

  function handleFeedScroll() {
    const nextScrollTop = containerRef.current?.scrollTop ?? 0;
    const delta = nextScrollTop - lastFeedScrollTopRef.current;
    lastFeedScrollTopRef.current = nextScrollTop;

    if (Math.abs(delta) < 1) {
      return;
    }

    scheduleSidePanelReveal(activeIndexRef.current);
  }

  const content =
    feedQuery.isLoading ? (
      <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
        <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
          피드를 불러오는 중입니다.
        </div>
      </section>
    ) : feedQuery.isError ? (
      <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
        <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
          피드를 불러오지 못했습니다.
        </div>
      </section>
    ) : feedItems.length === 0 ? (
      <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
        <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
          공개된 콘텐츠가 아직 없습니다.
        </div>
      </section>
    ) : (
      <>
        {feedItems.map((item, index) => (
          <FeedSlide
            interactionState={interactionByPublishId.get(item.publishId)}
            isInteractionPending={
              (discourseLikeMutation.isPending && discourseLikeMutation.variables?.publishId === item.publishId) ||
              (feedLikeMutation.isPending && feedLikeMutation.variables?.item.publishId === item.publishId) ||
              (bookmarkMutation.isPending && bookmarkMutation.variables?.item.publishId === item.publishId)
            }
            isOpening={openingPublishId === item.publishId}
            isSidePanelVisible={visibleSidePanelIndex === index}
            item={item}
            key={item.publishId}
            likedOverride={
              item.type === 'short_drama'
                ? undefined
                : discourseInteractionQuery.data?.publishId === item.publishId
                  ? discourseInteractionQuery.data.liked
                  : undefined
            }
            metricsOverride={
              item.type !== 'short_drama' && discourseInteractionQuery.data?.publishId === item.publishId
                ? {
                    comments: discourseInteractionQuery.data.metrics.comments,
                    likes: discourseInteractionQuery.data.metrics.likes
                  }
                : undefined
            }
            onBookmark={() => handleBookmarkFeedItem(item)}
            onComment={handleCommentFeedItem}
            onLike={() => handleLikeFeedItem(item)}
            onOpen={() => {
              void handleOpenFeedItem(item);
            }}
            onPreloadIntent={() => handlePreloadFeedItem(item)}
            onShare={() => {
              void handleShareFeedItem(item);
            }}
          />
        ))}
        {isFetchingNextPage ? (
          <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-sm text-white/55">
            <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
              다음 콘텐츠를 불러오는 중입니다.
            </div>
          </section>
        ) : null}
      </>
    );

  return (
    <main className="feed-page relative mx-auto min-h-dvh max-w-[480px] overflow-hidden bg-black text-white shadow-[0_0_80px_rgba(0,0,0,0.42)]">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden h-14 items-center bg-black/92 px-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
        <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-3">
          <button
            aria-label="피드 메뉴"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={() => setIsFeedMenuOpen(true)}
            type="button"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </button>
          <button
            aria-label="Promptoon feed"
            className="flex min-w-0 items-center gap-2 rounded-full pr-3 text-white transition hover:text-white/86 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={() => navigate('/discovery')}
            type="button"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img alt="" className="h-full w-full object-cover" src="/promptoon-icon.webp" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">Promptoon</span>
          </button>
        </div>

        <form className="pointer-events-auto mx-8 flex w-[min(38rem,42vw)] items-center" onSubmit={handleSearchSubmit}>
          <label className="sr-only" htmlFor="feed-desktop-search">
            검색
          </label>
          <input
            className="h-10 min-w-0 flex-1 rounded-l-full border border-white/16 bg-black px-5 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white/38"
            id="feed-desktop-search"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="검색"
            type="search"
            value={searchQuery}
          />
          <button
            aria-label="검색"
            className="inline-flex h-10 w-14 items-center justify-center rounded-r-full border border-l-0 border-white/16 bg-white/10 text-white/78 transition hover:bg-white/16 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            type="submit"
          >
            <Search aria-hidden className="h-5 w-5" />
          </button>
        </form>

        <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/86 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={() => navigate('/promptoon/projects')}
            type="button"
          >
            <Plus aria-hidden className="h-5 w-5" />
            <span>만들기</span>
          </button>
          <button
            aria-label="알림"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            type="button"
          >
            <Bell aria-hidden className="h-5 w-5" />
          </button>
          <button
            aria-label={isAuthenticated ? `${user?.loginId ?? 'MY'} 계정` : '로그인'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={() => navigate(isAuthenticated ? '/promptoon/projects' : '/login')}
            type="button"
          >
            {isAuthenticated ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-zinc-950">
                {userInitial}
              </span>
            ) : (
              <UserCircle aria-hidden className="h-6 w-6" />
            )}
          </button>
        </div>
      </header>

      <div className="pointer-events-none fixed left-1/2 top-0 z-40 w-full max-w-[480px] -translate-x-1/2 px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <div className="pointer-events-auto flex items-center justify-end">
          <div className="flex shrink-0 items-center gap-3 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
            <button
              aria-label="검색"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={() => navigate('/overview')}
              title="검색"
              type="button"
            >
              <Search aria-hidden className="h-5 w-5" />
            </button>
            <button
              aria-expanded={isFeedMenuOpen}
              aria-label="피드 메뉴"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/82 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              onClick={() => setIsFeedMenuOpen(true)}
              title="피드 메뉴"
              type="button"
            >
              <EllipsisVertical aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="feed-snap-scroller overflow-y-auto snap-y snap-mandatory scrollbar-hidden" onScroll={handleFeedScroll} ref={containerRef}>
        {content}
      </div>

      <FeedBottomNav isAuthenticated={isAuthenticated} isVisible userLoginId={user?.loginId} />

      {isCommentsPanelOpen && commentsPanelItem ? (
        commentsPanelItem.type === 'short_drama' ? (
          <FeedCommentsPanel
            item={commentsPanelItem}
            onClose={() => setIsCommentsPanelOpen(false)}
            onCommentCreated={handleCommentCreated}
          />
        ) : (
          <FeedDiscourseCommentsPanel
            item={commentsPanelItem}
            onClose={() => setIsCommentsPanelOpen(false)}
            onCommentCreated={handleCommentCreated}
          />
        )
      ) : null}

      {isFeedMenuOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="피드 메뉴 닫기"
            className="absolute inset-0 cursor-default bg-black/45"
            onClick={() => setIsFeedMenuOpen(false)}
            type="button"
          />
          <section
            aria-labelledby="feed-menu-title"
            aria-modal="true"
            className="relative w-full max-w-[min(100vw,calc(100dvh*9/16))] rounded-t-[28px] border-t border-white/10 bg-zinc-950/96 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            role="dialog"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/24" />
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-white" id="feed-menu-title">
                피드 메뉴
              </h2>
              <button
                aria-label="닫기"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={() => setIsFeedMenuOpen(false)}
                type="button"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {FEED_MENU_DESCRIPTIONS.map((item) => (
                <div key={item.title}>
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/62">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
