import type { FeedItem } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { preloadViewerForPublish } from '../../../features/viewer/lib/preload-viewer';
import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { ApiError } from '../../../shared/api/client';
import { landingApi } from '../../../shared/api/landing.api';
import { platformAccessApi } from '../../../shared/api/platform-access.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import {
  CONSUMER_FRAME_CLASS,
  CONSUMER_RIGHT_FRAME_CLASS,
  ConsumerDesktopLandingPanel
} from '../../consumer/components/ConsumerResponsiveFrame';
import { MovingtoonVideoPlayer } from '../../../widgets/public-feed/MovingtoonVideoPlayer';
import { FeedActionRail } from '../components/FeedActionRail';
import { FeedCommentsPanel } from '../components/FeedCommentsPanel';

const DEMO_FEED_LIMIT = 10;
const VIEWER_NAVIGATION_DELAY_MS = 120;

function flattenDemoItems(data: Awaited<ReturnType<typeof landingApi.getLanding>> | undefined): FeedItem[] {
  return (data?.items ?? []).slice(0, DEMO_FEED_LIMIT);
}

function getRedeemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return '특별 코드를 확인해 주세요.';
}

function getDemoPosterUrl(item: FeedItem) {
  return item.coverImageUrl ?? item.startCut.assetUrl;
}

function getDemoMetrics(item: FeedItem) {
  return item.metrics ?? { comments: 0, likes: 0, shares: 0, views: 0 };
}

function DemoPosterSlide({
  isOpening,
  isSidePanelVisible,
  item,
  onComment,
  onOpen,
  onPreloadIntent
}: {
  isOpening?: boolean;
  isSidePanelVisible?: boolean;
  item: FeedItem;
  onComment: () => void;
  onOpen: () => void;
  onPreloadIntent?: () => void;
}) {
  const posterUrl = getDemoPosterUrl(item);
  const shouldRenderVideo = item.type === 'short_drama' && Boolean(item.videoUrl);
  const visibilityClass = isSidePanelVisible ? 'opacity-100' : 'pointer-events-none opacity-0';

  return (
    <section className="feed-snap-slide relative flex snap-start snap-always items-center justify-center overflow-hidden bg-[#050506] text-white" data-feed-slide>
      <div className="feed-viewport-frame relative overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        {shouldRenderVideo ? (
          <MovingtoonVideoPlayer
            className="absolute inset-0 h-full w-full bg-black"
            posterUrl={posterUrl}
            title={item.episodeTitle}
            videoUrl={item.videoUrl ?? ''}
          />
        ) : posterUrl ? (
          <img alt={item.episodeTitle} className="absolute inset-0 h-full w-full object-cover" src={posterUrl} />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#131316,#202327_52%,#050506)]" />
        )}
        <button
          aria-label={`${item.episodeTitle} 보기`}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          disabled={isOpening}
          onClick={onOpen}
          onFocus={onPreloadIntent}
          onPointerEnter={onPreloadIntent}
          type="button"
        />
      </div>

      <div
        className={[
          'absolute bottom-0 right-3 z-20 flex items-end pb-3 transition-opacity duration-200 ease-out sm:right-5',
          visibilityClass
        ].join(' ')}
      >
        <FeedActionRail metrics={getDemoMetrics(item)} onComment={onComment} />
      </div>

      <div
        className={[
          'absolute inset-x-0 bottom-0 z-10 px-5 pb-5 transition-opacity duration-200 ease-out sm:px-6',
          visibilityClass
        ].join(' ')}
      >
        <button
          aria-busy={isOpening ? 'true' : undefined}
          className="inline-flex h-11 items-center justify-center bg-white px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/30 transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-75"
          disabled={isOpening}
          onClick={onOpen}
          onFocus={onPreloadIntent}
          onPointerEnter={onPreloadIntent}
          type="button"
        >
          {isOpening ? '여는 중...' : '보러 가기'}
        </button>
      </div>
    </section>
  );
}

function DemoGateSlide({
  code,
  errorMessage,
  isPending,
  onCodeChange,
  onSubmit
}: {
  code: string;
  errorMessage?: string | null;
  isPending?: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] px-5 text-white">
      <div className="feed-viewport-frame flex flex-col overflow-hidden bg-[linear-gradient(180deg,#012d28_0%,#001512_32%,#000_72%)] px-6 py-8 text-center shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        <div className="flex flex-1 flex-col items-center justify-center">
          <img alt="Promptoon" className="h-auto w-full max-w-[17rem] rounded-lg object-contain" src="/promptoon-logo.webp" />
          <h1 className="mt-8 font-display text-3xl font-black tracking-normal text-white">코드 입력</h1>
        </div>

        <form className="shrink-0 space-y-3" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="platform-access-code">
            코드 입력
          </label>
          <input
            autoComplete="one-time-code"
            className="h-12 w-full rounded-md border border-white/12 bg-white px-4 text-center text-sm font-black uppercase tracking-[0.18em] text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#1fffe6] focus:ring-2 focus:ring-[#1fffe6]/40"
            id="platform-access-code"
            onChange={(event) => onCodeChange(event.target.value)}
            value={code}
          />
          {errorMessage ? <p className="text-sm font-semibold text-rose-200">{errorMessage}</p> : null}
          <button
            className="h-12 w-full rounded-xl bg-[#146bff] px-5 py-3 text-base font-bold text-white transition hover:bg-[#0e5be2] disabled:cursor-wait disabled:opacity-60"
            disabled={isPending || code.trim().length === 0}
            type="submit"
          >
            {isPending ? '확인 중...' : '확인'}
          </button>
        </form>
      </div>
    </section>
  );
}

export function DemoEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openingPublishId, setOpeningPublishId] = useState<string | null>(null);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [commentsPanelItem, setCommentsPanelItem] = useState<FeedItem | null>(null);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const landingQuery = useQuery({
    queryKey: promptoonKeys.landing(),
    queryFn: landingApi.getLanding
  });
  const feedItems = useMemo(() => flattenDemoItems(landingQuery.data), [landingQuery.data]);
  const redeemMutation = useMutation({
    mutationFn: platformAccessApi.redeemCode,
    onSuccess: async () => {
      setCode('');
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.platformAccess() });
      navigate('/platform', { replace: true });
    },
    onError: (error) => {
      setErrorMessage(getRedeemErrorMessage(error));
    }
  });

  useEffect(() => {
    if (landingQuery.data?.enabled === false) {
      navigate('/platform', { replace: true });
    }
  }, [landingQuery.data?.enabled, navigate]);

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

          const rawIndex = Number((entry.target as HTMLElement).dataset.demoIndex);
          if (Number.isNaN(rawIndex) || entry.intersectionRatio <= nextRatio) {
            continue;
          }

          nextIndex = rawIndex;
          nextRatio = entry.intersectionRatio;
        }

        if (nextIndex >= 0) {
          startTransition(() => setActiveIndex(nextIndex));
        }
      },
      {
        root: container,
        threshold: [0.75, 0.9, 1]
      }
    );

    const slides = Array.from(container.querySelectorAll<HTMLElement>('[data-demo-slide]'));
    for (const [index, slide] of slides.entries()) {
      slide.dataset.demoIndex = String(index);
      observer.observe(slide);
    }

    return () => observer.disconnect();
  }, [feedItems.length]);

  useEffect(() => {
    if (searchParams.get('gate') !== '1' || feedItems.length === 0) {
      return;
    }

    window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.clientHeight * feedItems.length,
        behavior: 'smooth'
      });
    }, 120);
  }, [feedItems.length, searchParams]);

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
      // Viewer route has its own loading state.
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, VIEWER_NAVIGATION_DELAY_MS);
    });

    navigate(`/v/${item.publishId}`);
  }

  function handleCommentFeedItem(item: FeedItem) {
    setCommentsPanelItem(item);
    setIsCommentsPanelOpen(true);
  }

  function handlePreloadFeedItem(item: FeedItem) {
    if (item.type === 'short_drama') {
      return;
    }

    void preloadViewerForPublish(item.publishId).catch(() => undefined);
  }

  function handleCommentCreated() {
    if (!commentsPanelItem) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: promptoonKeys.landing() }),
      queryClient.invalidateQueries({ queryKey: promptoonKeys.communityComments(commentsPanelItem.publishId) }),
      queryClient.invalidateQueries({ queryKey: promptoonKeys.communityCommentsMeta(commentsPanelItem.publishId) })
    ]).catch(() => undefined);
  }

  function handleGateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: '/?gate=1'
        }
      });
      return;
    }

    redeemMutation.mutate(normalizedCode);
  }

  const content = landingQuery.isLoading || landingQuery.data?.enabled === false ? (
    <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
      <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        데모를 불러오는 중입니다.
      </div>
    </section>
  ) : landingQuery.isError || feedItems.length === 0 ? (
    <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
      <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        공개된 대문 콘텐츠가 없습니다.
      </div>
    </section>
  ) : (
    <>
      {feedItems.map((item, index) => (
        <div data-demo-slide key={item.publishId}>
          <DemoPosterSlide
            isOpening={openingPublishId === item.publishId}
            isSidePanelVisible={activeIndex === index}
            item={item}
            onComment={() => handleCommentFeedItem(item)}
            onOpen={() => {
              void handleOpenFeedItem(item);
            }}
            onPreloadIntent={() => handlePreloadFeedItem(item)}
          />
        </div>
      ))}
      <div data-demo-slide>
        <DemoGateSlide
          code={code}
          errorMessage={errorMessage}
          isPending={redeemMutation.isPending}
          onCodeChange={setCode}
          onSubmit={handleGateSubmit}
        />
      </div>
    </>
  );

  return (
    <main className={`min-h-dvh bg-[#050506] text-white ${isCommentsPanelOpen && commentsPanelItem ? 'feed-comments-open' : ''}`}>
      <div className={CONSUMER_FRAME_CLASS}>
        <ConsumerDesktopLandingPanel />
        <section className={`${CONSUMER_RIGHT_FRAME_CLASS} feed-page relative overflow-hidden !bg-black shadow-[0_0_80px_rgba(0,0,0,0.42)]`}>
          <div className="feed-snap-scroller overflow-y-auto snap-y snap-mandatory scrollbar-hidden" ref={containerRef}>
            {content}
          </div>
        </section>
      </div>

      {isCommentsPanelOpen && commentsPanelItem ? (
        <FeedCommentsPanel
          item={commentsPanelItem}
          onClose={() => setIsCommentsPanelOpen(false)}
          onCommentCreated={handleCommentCreated}
        />
      ) : null}
    </main>
  );
}
