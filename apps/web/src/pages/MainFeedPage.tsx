import type { FeedItem } from '@promptoon/shared';
import { useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFeedQuery } from '../features/feed/hooks/use-feed-query';
import { useFeedTelemetry } from '../features/feed/hooks/use-feed-telemetry';
import { FeedSlide } from '../widgets/public-feed/FeedSlide';

function flattenFeedItems(pages: Array<{ items: FeedItem[] }> | undefined) {
  if (!pages) {
    return [];
  }

  return pages.flatMap((page) => page.items);
}

export function MainFeedPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewedPublishIdsRef = useRef(new Set<string>());
  const preloadedAssetUrlsRef = useRef(new Set<string>());
  const [activeIndex, setActiveIndex] = useState(0);
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
      .map((item) => item.startCut.assetUrl)
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

  function handleChoiceClick(item: FeedItem, choiceId: string) {
    const choice = item.startChoices.find((candidate) => candidate.id === choiceId);
    if (!choice?.nextCutId) {
      return;
    }

    telemetry.trackChoiceClick(item, choice.id);
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
        <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs tracking-[0.18em] text-white/65 backdrop-blur">
          SWIPE FOR STORY
        </div>
      </div>

      <div className="h-dvh overflow-y-scroll snap-y snap-mandatory" ref={containerRef}>
        {feedItems.map((item) => (
          <FeedSlide item={item} key={item.publishId} onChoiceClick={(choiceId) => handleChoiceClick(item, choiceId)} />
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
