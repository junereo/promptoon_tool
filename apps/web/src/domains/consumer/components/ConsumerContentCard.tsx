import type { FeedItem, FeedItemType } from '@promptoon/shared';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';

import { preloadFeedItemRoute } from '../../../app/lazy-routes';

const TYPE_LABELS: Record<FeedItemType, string> = {
  channel_recommendation: '채널',
  promptoon: '프롬툰',
  short_drama: '숏드라마',
  webtoon_episode: '웹툰'
};

export function getConsumerContentHref(item: FeedItem): string {
  if (item.entry?.href) {
    return item.entry.href;
  }

  return item.type === 'short_drama' ? `/shorts/${item.publishId}` : `/v/${item.publishId}`;
}

function getPosterUrl(item: FeedItem): string | null {
  return item.coverImageUrl ?? item.startCut.assetUrl ?? null;
}

function getTypeLabel(item: FeedItem): string {
  return item.type ? TYPE_LABELS[item.type] : '프롬툰';
}

function PosterSilhouette({ state }: { state: 'failed' | 'loading' | 'ready' }) {
  const isVisible = state !== 'ready';

  return (
    <div
      aria-hidden
      className={[
        'absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,#111116,#20232a_54%,#09090b)] transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0'
      ].join(' ')}
      data-loading-state={state}
      data-testid="consumer-card-image-silhouette"
    >
      <div className="absolute inset-0 animate-pulse">
        <div className="absolute inset-x-[14%] top-[12%] h-[38%] rounded-md bg-white/[0.055]" />
        <div className="absolute left-[12%] top-[58%] h-3 w-[54%] rounded-full bg-white/[0.09]" />
        <div className="absolute left-[12%] top-[66%] h-2.5 w-[68%] rounded-full bg-white/[0.06]" />
        <div className="absolute bottom-0 left-0 right-0 h-[38%] bg-[linear-gradient(0deg,rgba(0,0,0,0.58),transparent)]" />
      </div>
    </div>
  );
}

export function ConsumerContentCard({
  imageFetchPriority = 'auto',
  imageLoading = 'lazy',
  item,
  rank
}: {
  imageFetchPriority?: 'auto' | 'high' | 'low';
  imageLoading?: 'eager' | 'lazy';
  item: FeedItem;
  rank?: number;
}) {
  const posterUrl = getPosterUrl(item);
  const href = getConsumerContentHref(item);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loadedPosterUrl, setLoadedPosterUrl] = useState<string | null>(null);
  const [failedPosterUrl, setFailedPosterUrl] = useState<string | null>(null);
  const isPosterReady = Boolean(posterUrl) && loadedPosterUrl === posterUrl;
  const posterLoadingState = isPosterReady ? 'ready' : posterUrl && failedPosterUrl === posterUrl ? 'failed' : 'loading';

  function preloadRoute() {
    void preloadFeedItemRoute(item, href).catch(() => undefined);
  }

  useEffect(() => {
    setLoadedPosterUrl(null);
    setFailedPosterUrl(null);

    if (!posterUrl) {
      return;
    }

    const imageElement = imageRef.current;
    if (!imageElement?.complete) {
      return;
    }

    if (imageElement.naturalWidth <= 0) {
      setFailedPosterUrl(posterUrl);
      return;
    }

    if (typeof imageElement.decode === 'function') {
      let isCancelled = false;

      void imageElement.decode().then(
        () => {
          if (!isCancelled) {
            setLoadedPosterUrl(posterUrl);
          }
        },
        () => {
          if (!isCancelled) {
            setLoadedPosterUrl(posterUrl);
          }
        }
      );

      return () => {
        isCancelled = true;
      };
    }

    setLoadedPosterUrl(posterUrl);
  }, [posterUrl]);

  function handlePosterResolved(event: SyntheticEvent<HTMLImageElement>) {
    const imageElement = event.currentTarget;

    if (typeof imageElement.decode === 'function') {
      void imageElement.decode().then(
        () => setLoadedPosterUrl(posterUrl),
        () => setLoadedPosterUrl(posterUrl)
      );
      return;
    }

    setLoadedPosterUrl(posterUrl);
  }

  function handlePosterError() {
    setFailedPosterUrl(posterUrl);
  }

  return (
    <Link
      className="group block min-w-0"
      onFocus={preloadRoute}
      onPointerDown={preloadRoute}
      onPointerEnter={preloadRoute}
      onTouchStart={preloadRoute}
      to={href}
    >
      <article className="min-w-0">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-900">
          <PosterSilhouette state={posterLoadingState} />
          {posterUrl ? (
            <img
              alt=""
              className={[
                'h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]',
                isPosterReady ? 'opacity-100' : 'opacity-0'
              ].join(' ')}
              fetchPriority={imageFetchPriority}
              loading={imageLoading}
              onError={handlePosterError}
              onLoad={handlePosterResolved}
              ref={imageRef}
              src={posterUrl}
            />
          ) : null}
          {rank ? (
            <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-md bg-white px-2 text-xs font-black text-zinc-950">
              {rank}
            </span>
          ) : null}
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {getTypeLabel(item)}
            </span>
            {item.isExperimental ? (
              <span className="rounded-md bg-amber-300 px-2 py-1 text-[11px] font-black text-zinc-950 shadow-sm">
                실험용
              </span>
            ) : null}
          </div>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white">{item.episodeTitle}</h3>
        <p className="mt-0.5 truncate text-xs text-white/48">{item.projectTitle}</p>
      </article>
    </Link>
  );
}
