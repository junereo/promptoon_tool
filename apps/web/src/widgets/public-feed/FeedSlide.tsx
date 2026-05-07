import type { ContentInteractionState, FeedItem } from '@promptoon/shared';
import { Link } from 'react-router-dom';

import { FeedActionBar } from './FeedActionBar';
import { MovingtoonVideoPlayer } from './MovingtoonVideoPlayer';

export function FeedSlide({
  interactionState,
  isInteractionPending,
  isOpening,
  item,
  onBookmark,
  onComment,
  onLike,
  onOpen,
  onPreloadIntent,
  onShare,
  progress
}: {
  interactionState?: ContentInteractionState;
  isInteractionPending?: boolean;
  isOpening?: boolean;
  item: FeedItem;
  onBookmark?: () => void;
  onComment?: () => void;
  onLike?: () => void;
  onOpen: () => void;
  onPreloadIntent?: () => void;
  onShare?: () => void;
  progress?: number;
}) {
  const posterUrl = item.coverImageUrl ?? item.startCut.assetUrl;
  const progressValue = Math.max(0, Math.min(100, progress ?? 0));
  const metrics = interactionState?.metrics ?? item.metrics ?? { comments: 0, likes: 0, shares: 0, views: 0 };
  const shouldRenderVideo = item.type === 'short_drama' && Boolean(item.videoUrl);

  return (
    <article
      className="relative flex h-dvh w-full snap-start snap-always items-center justify-center overflow-hidden bg-black"
      data-feed-slide
      data-publish-id={item.publishId}
    >
      <div className="absolute inset-0 bg-black" />

      <div
        className={[
          'feed-viewport-frame relative z-10 flex h-full w-full flex-col justify-end overflow-hidden bg-black px-5 pt-8 shadow-[0_0_80px_rgba(0,0,0,0.5)] sm:px-8',
          shouldRenderVideo ? 'pb-24 sm:pb-28' : 'pb-8 sm:pb-10'
        ].join(' ')}
        data-testid="feed-poster-frame"
      >
        {shouldRenderVideo ? (
          <MovingtoonVideoPlayer
            className="absolute inset-0 h-full w-full object-cover"
            posterUrl={posterUrl}
            title={item.episodeTitle}
            videoUrl={item.videoUrl ?? ''}
          />
        ) : posterUrl ? (
          <img alt={item.episodeTitle} className="absolute inset-0 h-full w-full object-cover" src={posterUrl} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a21] via-[#111115] to-black" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/58 via-black/20 to-transparent" />

        <div className="relative z-20 flex w-full items-end gap-4 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            {item.channelSlug ? (
              <Link
                className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 text-xs font-medium text-white/80 transition hover:bg-black/65"
                to={`/c/${item.channelSlug}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/12 text-[10px] font-semibold text-white ring-1 ring-white/20">
                  {item.channelAvatarUrl ? (
                    <img alt="" className="h-full w-full object-cover" src={item.channelAvatarUrl} />
                  ) : (
                    (item.channelName ?? item.projectTitle).trim().slice(0, 1).toUpperCase() || 'P'
                  )}
                </span>
                <span className="truncate">{item.channelName ?? item.projectTitle}</span>
              </Link>
            ) : null}
            <div className="flex w-full min-w-0 overflow-hidden">
              <h1 className="truncate font-display text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                {item.episodeTitle}
              </h1>
            </div>
            <button
              aria-busy={isOpening ? 'true' : undefined}
              className="mt-7 flex h-12 w-full items-center justify-center rounded-2xl bg-editor-accent px-5 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(122,48,64,0.35)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-editor-accentSoft focus:ring-offset-2 focus:ring-offset-black disabled:cursor-wait disabled:opacity-80 disabled:hover:brightness-100"
              disabled={isOpening}
              onFocus={onPreloadIntent}
              onClick={onOpen}
              onPointerEnter={onPreloadIntent}
              type="button"
            >
              {isOpening ? '여는 중...' : '지금 보기'}
            </button>
            <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-white/55">
              <span>{metrics.views.toLocaleString('ko-KR')} views</span>
              <span>{metrics.likes.toLocaleString('ko-KR')} likes</span>
              <span>{metrics.comments.toLocaleString('ko-KR')} replies</span>
              <span>{metrics.shares.toLocaleString('ko-KR')} shares</span>
            </div>
          </div>
          <FeedActionBar
            bookmarked={interactionState?.bookmarked}
            disabled={isInteractionPending}
            liked={interactionState?.liked}
            metrics={metrics}
            onBookmark={onBookmark}
            onComment={onComment}
            onLike={onLike}
            onShare={onShare}
          />
        </div>
        {isOpening ? (
          <div className="absolute inset-x-0 bottom-0 z-30 h-[2px] bg-white/12" data-testid="feed-open-progress">
            <div
              className="h-full bg-editor-accentSoft transition-[width] duration-150 ease-out"
              style={{ width: `${progressValue}%` }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
