import type { FeedItem } from '@promptoon/shared';
import { useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFeedQuery } from '../features/feed/hooks/use-feed-query';
import { useFeedTelemetry } from '../features/feed/hooks/use-feed-telemetry';
import { preloadViewerForPublish } from '../features/viewer/lib/preload-viewer';
import { FeedSlide } from '../widgets/public-feed/FeedSlide';

const FEED_BANNER_INSERT_AFTER_INDEX = 4;
const FEED_BANNER_LINK_URL = 'https://www.instagram.com/promptoon_ai/';
const VIEWER_NAVIGATION_DELAY_MS = 120;

function flattenFeedItems(pages: Array<{ items: FeedItem[] }> | undefined) {
  if (!pages) {
    return [];
  }

  return pages.flatMap((page) => page.items);
}

function shouldRenderFeedBannerAfter(index: number, totalItems: number): boolean {
  if (totalItems === 0) {
    return false;
  }

  return index === Math.min(FEED_BANNER_INSERT_AFTER_INDEX, totalItems - 1);
}

function FeedBannerSlide() {
  return (
    <article
      aria-label="Promptoon recommendation"
      className="relative flex h-dvh w-full snap-start snap-always items-center justify-center overflow-hidden bg-black"
      data-feed-banner
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#18181d] via-[#101015] to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_42%)]" />

      <div
        className="feed-viewport-frame relative z-10 flex h-full w-full flex-col justify-center overflow-hidden bg-[#08080a] px-6 shadow-[0_0_80px_rgba(0,0,0,0.5)]"
        data-testid="feed-banner-slide"
      >
        <a
          aria-label="Promptoon Instagram"
          className="block rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30 transition hover:border-white/20 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-editor-accentSoft focus:ring-offset-2 focus:ring-offset-black"
          href={FEED_BANNER_LINK_URL}
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt="Promptoon"
            className="h-auto w-full rounded-[20px] object-contain"
            src="/promptoon-banner.png"
          />
          <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-white/45">Promptoon Pick</p>
          <p className="mt-3 font-display text-2xl font-semibold leading-tight text-white">
            다음 선택형 이야기를 놓치지 마세요..
          </p>
          <p className="mt-3 text-sm leading-6 text-white/60">
            짧게 넘기며 보고, 마음에 드는 에피소드는 탭해서 바로 시작할 수 있습니다.
          </p>
        </a>
      </div>
    </article>
  );
}

export function MainFeedPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewedPublishIdsRef = useRef(new Set<string>());
  const preloadedAssetUrlsRef = useRef(new Set<string>());
  const [activeIndex, setActiveIndex] = useState(0);
  const [openingProgress, setOpeningProgress] = useState(0);
  const [openingPublishId, setOpeningPublishId] = useState<string | null>(null);
  const feedQuery = useFeedQuery();
  const telemetry = useFeedTelemetry();
  const feedItems = useMemo(() => flattenFeedItems(feedQuery.data?.pages), [feedQuery.data?.pages]);
  const deferredActiveIndex = useDeferredValue(activeIndex);
  const activeItem = feedItems[deferredActiveIndex] ?? null;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feedQuery;

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
  }, [feedItems.length]);

  useEffect(() => {
    if (!activeItem || viewedPublishIdsRef.current.has(activeItem.publishId)) {
      return;
    }

    viewedPublishIdsRef.current.add(activeItem.publishId);
    telemetry.trackImpression(activeItem);
  }, [activeItem, telemetry]);

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

  useEffect(() => {
    if (!openingPublishId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setOpeningProgress((currentProgress) => {
        if (currentProgress >= 70) {
          return 70;
        }

        const nextProgress = currentProgress + Math.max(1.2, (70 - currentProgress) * 0.16);
        return Math.min(70, nextProgress);
      });
    }, 80);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [openingPublishId]);

  function handlePreloadFeedItem(item: FeedItem) {
    void preloadViewerForPublish(item.publishId).catch(() => {
      // The click path still navigates and lets the viewer render its existing fallback.
    });
  }

  async function handleOpenFeedItem(item: FeedItem) {
    if (openingPublishId) {
      return;
    }

    setOpeningPublishId(item.publishId);
    setOpeningProgress(0);

    try {
      await preloadViewerForPublish(item.publishId);
    } catch {
      // Keep the old behavior on preload failure: enter the viewer and let it handle the state.
    }

    setOpeningProgress(100);

    await new Promise((resolve) => {
      window.setTimeout(resolve, VIEWER_NAVIGATION_DELAY_MS);
    });

    navigate(`/v/${item.publishId}`);
  }

  if (feedQuery.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black text-zinc-400">
        피드를 불러오는 중입니다.
      </main>
    );
  }

  if (feedQuery.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-zinc-400">
        피드를 불러오지 못했습니다.
      </main>
    );
  }

  if (feedItems.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-zinc-400">
        공개된 에피소드가 아직 없습니다.
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-black text-white">
      <div className="scrollbar-hidden h-dvh overflow-y-auto snap-y snap-mandatory" ref={containerRef}>
        {feedItems.map((item, index) => (
          <div className="contents" key={item.publishId}>
            <FeedSlide
              isOpening={openingPublishId === item.publishId}
              item={item}
              onOpen={() => {
                void handleOpenFeedItem(item);
              }}
              onPreloadIntent={() => handlePreloadFeedItem(item)}
              progress={openingPublishId === item.publishId ? openingProgress : 0}
            />
            {shouldRenderFeedBannerAfter(index, feedItems.length) ? <FeedBannerSlide /> : null}
          </div>
        ))}

        {isFetchingNextPage ? (
          <div className="flex h-dvh snap-start snap-always items-center justify-center text-sm text-white/55">
            다음 에피소드를 불러오는 중입니다.
          </div>
        ) : null}
      </div>
    </main>
  );
}
