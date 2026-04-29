import type { FeedItem } from '@promptoon/shared';

export function FeedSlide({
  isOpening,
  item,
  onOpen,
  onPreloadIntent,
  progress
}: {
  isOpening?: boolean;
  item: FeedItem;
  onOpen: () => void;
  onPreloadIntent?: () => void;
  progress?: number;
}) {
  const posterUrl = item.coverImageUrl ?? item.startCut.assetUrl;
  const progressValue = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <article
      className="relative flex h-dvh w-full snap-start snap-always items-center justify-center overflow-hidden bg-black"
      data-feed-slide
      data-publish-id={item.publishId}
    >
      <div className="absolute inset-0 bg-black" />

      <div
        className="feed-viewport-frame relative z-10 flex h-full w-full flex-col justify-end overflow-hidden bg-black px-5 pb-8 pt-8 shadow-[0_0_80px_rgba(0,0,0,0.5)] sm:px-8 sm:pb-10"
        data-testid="feed-poster-frame"
      >
        {posterUrl ? (
          <img alt={item.episodeTitle} className="absolute inset-0 h-full w-full object-cover" src={posterUrl} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a21] via-[#111115] to-black" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/58 via-black/20 to-transparent" />

        <div className="relative z-20 w-full overflow-hidden">
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
