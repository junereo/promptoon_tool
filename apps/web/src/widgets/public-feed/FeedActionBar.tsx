import type { FeedItemMetrics } from '@promptoon/shared';

function formatCompact(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: value >= 10000 ? 1 : 0,
    notation: value >= 10000 ? 'compact' : 'standard'
  }).format(value);
}

export function FeedActionBar({
  bookmarked,
  disabled,
  liked,
  metrics,
  onBookmark,
  onComment,
  onLike,
  onShare
}: {
  bookmarked?: boolean;
  disabled?: boolean;
  liked?: boolean;
  metrics: FeedItemMetrics;
  onBookmark?: () => void;
  onComment?: () => void;
  onLike?: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        aria-label={liked ? '좋아요 취소' : '좋아요'}
        aria-pressed={liked ? 'true' : 'false'}
        className={[
          'flex h-12 w-12 items-center justify-center rounded-full border text-xs font-semibold shadow-lg backdrop-blur transition',
          liked ? 'border-editor-accentSoft bg-editor-accent text-white' : 'border-white/12 bg-black/45 text-white/90 hover:bg-black/65'
        ].join(' ')}
        disabled={disabled}
        onClick={onLike}
        type="button"
      >
        Like
      </button>
      <span className="text-[11px] font-medium text-white/70">{formatCompact(metrics.likes)}</span>

      <button
        aria-label="댓글"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-black/45 text-xs font-semibold text-white/90 shadow-lg backdrop-blur transition hover:bg-black/65"
        disabled={disabled}
        onClick={onComment}
        type="button"
      >
        Reply
      </button>
      <span className="text-[11px] font-medium text-white/70">{formatCompact(metrics.comments)}</span>

      <button
        aria-label="공유"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-black/45 text-xs font-semibold text-white/90 shadow-lg backdrop-blur transition hover:bg-black/65"
        disabled={disabled}
        onClick={onShare}
        type="button"
      >
        Share
      </button>

      <button
        aria-label={bookmarked ? '저장 취소' : '저장'}
        aria-pressed={bookmarked ? 'true' : 'false'}
        className={[
          'flex h-12 w-12 items-center justify-center rounded-full border text-xs font-semibold shadow-lg backdrop-blur transition',
          bookmarked ? 'border-editor-accentSoft bg-white text-black' : 'border-white/12 bg-black/45 text-white/90 hover:bg-black/65'
        ].join(' ')}
        disabled={disabled}
        onClick={onBookmark}
        type="button"
      >
        Save
      </button>
    </div>
  );
}
