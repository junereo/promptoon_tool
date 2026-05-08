import type { ContentInteractionState, FeedItem, FeedItemMetrics, FeedItemType } from '@promptoon/shared';
import { Link } from 'react-router-dom';

import { MovingtoonVideoPlayer } from '../../../widgets/public-feed/MovingtoonVideoPlayer';
import { FeedActionRail } from './FeedActionRail';

const TYPE_LABELS: Record<FeedItemType, string> = {
  channel_recommendation: '추천 채널',
  short_drama: '숏드라마',
  promptoon: '프롬툰',
  webtoon_episode: '웹툰'
};

function getTypeLabel(type: FeedItem['type']) {
  return type ? TYPE_LABELS[type] : '프롬툰';
}

function getPosterUrl(item: FeedItem) {
  return item.coverImageUrl ?? item.startCut.assetUrl;
}

function getSummary(item: FeedItem) {
  return item.startCut.body?.trim() || item.projectTitle;
}

function getMetrics(
  interactionState: ContentInteractionState | undefined,
  item: FeedItem,
  metricsOverride: Partial<FeedItemMetrics> | undefined
): FeedItemMetrics {
  return {
    ...(interactionState?.metrics ?? item.metrics ?? { comments: 0, likes: 0, shares: 0, views: 0 }),
    ...metricsOverride
  };
}

function getCtaLabel(type: FeedItem['type']) {
  if (type === 'short_drama') {
    return '숏드라마 보기';
  }

  if (type === 'webtoon_episode') {
    return '웹툰 보기';
  }

  return '선택 시작';
}

function ChannelAvatar({
  avatarUrl,
  initial
}: {
  avatarUrl?: string | null;
  initial: string;
}) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-white/15 text-lg font-semibold text-white">
      {avatarUrl ? <img alt="" className="h-full w-full object-cover" src={avatarUrl} /> : initial}
    </span>
  );
}

export function FeedSlide({
  interactionState,
  isInteractionPending,
  isOpening,
  isSidePanelVisible = false,
  item,
  likedOverride,
  metricsOverride,
  onBookmark,
  onComment,
  onLike,
  onOpen,
  onPreloadIntent,
  onShare
}: {
  interactionState?: ContentInteractionState;
  isInteractionPending?: boolean;
  isOpening?: boolean;
  isSidePanelVisible?: boolean;
  item: FeedItem;
  likedOverride?: boolean;
  metricsOverride?: Partial<FeedItemMetrics>;
  onBookmark?: () => void;
  onComment?: () => void;
  onLike?: () => void;
  onOpen: () => void;
  onPreloadIntent?: () => void;
  onShare?: () => void;
}) {
  const posterUrl = getPosterUrl(item);
  const shouldRenderVideo = item.type === 'short_drama' && Boolean(item.videoUrl);
  const channelPath = item.channelSlug ? `/channel/${item.channelSlug}` : null;
  const metrics = getMetrics(interactionState, item, metricsOverride);
  const liked = likedOverride ?? interactionState?.liked;
  const choiceLabel = item.startChoices.length > 0 ? `${item.startChoices.length}개 선택` : '바로 보기';
  const publishedLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(item.publishedAt));
  const channelInitial = (item.channelName ?? item.projectTitle).trim().slice(0, 1).toUpperCase() || 'P';
  const deferredOverlayVisibilityClass = isSidePanelVisible ? 'opacity-100' : 'pointer-events-none opacity-0';

  return (
    <section className="feed-snap-slide relative flex snap-start snap-always items-center justify-center overflow-hidden bg-[#050506] text-white" data-feed-slide>
      <div
        className={[
          'feed-desktop-info-panel feed-desktop-side-panel absolute top-1/2 hidden w-[22rem] -translate-y-1/2 flex-col justify-end pb-10 text-left transition-opacity duration-200 ease-out',
          deferredOverlayVisibilityClass
        ].join(' ')}
      >
        <div className="max-w-[21rem]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-white/68">
            <span className="text-white">{getTypeLabel(item.type)}</span>
            <span>{publishedLabel}</span>
            <span>{choiceLabel}</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-white">
            {item.episodeTitle}
          </h1>
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-white/72">{getSummary(item)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">#{item.projectTitle}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">#{getTypeLabel(item.type)}</span>
          </div>

          <div className="mt-6 flex flex-col items-start gap-4">
            {channelPath ? (
              <Link className="flex min-w-0 max-w-full items-center gap-3" to={channelPath}>
                <ChannelAvatar avatarUrl={item.channelAvatarUrl} initial={channelInitial} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{item.channelName ?? item.projectTitle}</span>
                  <span className="block truncate text-xs text-white/58">@{item.channelSlug}</span>
                </span>
              </Link>
            ) : (
              <div className="flex min-w-0 max-w-full items-center gap-3">
                <ChannelAvatar avatarUrl={item.channelAvatarUrl} initial={channelInitial} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{item.channelName ?? item.projectTitle}</span>
                  <span className="block truncate text-xs text-white/58">{metrics.views.toLocaleString('ko-KR')} views</span>
                </span>
              </div>
            )}

            <button
              aria-busy={isOpening ? 'true' : undefined}
              className="inline-flex h-11 w-fit items-center justify-center bg-white px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/30 transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-75"
              disabled={isOpening}
              onClick={onOpen}
              onFocus={onPreloadIntent}
              onPointerEnter={onPreloadIntent}
              type="button"
            >
              {isOpening ? '여는 중...' : getCtaLabel(item.type)}
            </button>
          </div>
        </div>
      </div>

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
      </div>

      <div
        className={[
          'absolute inset-x-0 bottom-0 h-[46dvh] bg-[linear-gradient(0deg,rgba(0,0,0,0.9),rgba(0,0,0,0.46)_58%,transparent_100%)] transition-opacity duration-200 ease-out',
          deferredOverlayVisibilityClass
        ].join(' ')}
      />

      <div
        className={[
          'absolute bottom-0 right-3 z-20 flex items-end pb-3 transition-opacity duration-200 ease-out sm:right-5',
          deferredOverlayVisibilityClass
        ].join(' ')}
      >
        <FeedActionRail
          bookmarked={interactionState?.bookmarked}
          channelAvatarUrl={item.channelAvatarUrl}
          channelInitial={channelInitial}
          channelName={item.channelName ?? item.projectTitle}
          channelPath={channelPath}
          disabled={isInteractionPending}
          liked={liked}
          metrics={metrics}
          onBookmark={onBookmark}
          onComment={onComment}
          onLike={onLike}
          onShare={onShare}
        />
      </div>

      <div
        className={[
          'absolute inset-x-0 bottom-0 z-10 px-5 pr-24 pt-16 pb-3 transition-opacity duration-200 ease-out sm:px-6 sm:pr-24',
          deferredOverlayVisibilityClass
        ].join(' ')}
      >
        <div className="max-w-md">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="bg-white px-3 py-1 text-xs font-semibold text-zinc-950">{getTypeLabel(item.type)}</span>
            <span className="bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {publishedLabel}
            </span>
            <span className="bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              {choiceLabel}
            </span>
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.42)] sm:text-4xl">
            {item.episodeTitle}
          </h1>
          <p className="mt-3 line-clamp-3 max-w-md text-sm leading-6 text-white/82 sm:text-base">{getSummary(item)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="bg-white/12 px-3 py-1 text-xs font-medium text-white backdrop-blur">#{item.projectTitle}</span>
            <span className="bg-white/12 px-3 py-1 text-xs font-medium text-white backdrop-blur">#{getTypeLabel(item.type)}</span>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            {channelPath ? (
              <Link className="flex min-w-0 items-center gap-3" to={channelPath}>
                <ChannelAvatar avatarUrl={item.channelAvatarUrl} initial={channelInitial} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{item.channelName ?? item.projectTitle}</span>
                  <span className="block truncate text-xs text-white/62">@{item.channelSlug}</span>
                </span>
              </Link>
            ) : (
              <div className="flex min-w-0 items-center gap-3">
                <ChannelAvatar avatarUrl={item.channelAvatarUrl} initial={channelInitial} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{item.channelName ?? item.projectTitle}</span>
                  <span className="block truncate text-xs text-white/62">{metrics.views.toLocaleString('ko-KR')} views</span>
                </span>
              </div>
            )}

            <button
              aria-busy={isOpening ? 'true' : undefined}
              className="inline-flex h-11 w-fit items-center justify-center bg-white px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-black/30 transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-75"
              disabled={isOpening}
              onClick={onOpen}
              onFocus={onPreloadIntent}
              onPointerEnter={onPreloadIntent}
              type="button"
            >
              {isOpening ? '여는 중...' : getCtaLabel(item.type)}
            </button>
          </div>
        </div>
      </div>

      <div
        className={[
          'feed-desktop-action-panel feed-desktop-side-panel absolute top-1/2 hidden w-16 -translate-y-1/2 items-end pb-10 transition-opacity duration-200 ease-out',
          deferredOverlayVisibilityClass
        ].join(' ')}
      >
        <FeedActionRail
          bookmarked={interactionState?.bookmarked}
          channelAvatarUrl={item.channelAvatarUrl}
          channelInitial={channelInitial}
          channelName={item.channelName ?? item.projectTitle}
          channelPath={channelPath}
          disabled={isInteractionPending}
          liked={liked}
          metrics={metrics}
          onBookmark={onBookmark}
          onComment={onComment}
          onLike={onLike}
          onShare={onShare}
        />
      </div>
    </section>
  );
}
