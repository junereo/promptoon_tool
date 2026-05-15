import type { FeedItemMetrics } from '@promptoon/shared';
import type { ComponentType, SVGProps } from 'react';
import { Bookmark, Heart01 as Heart, Link as LinkIcon, ChatCircle as MessageCircle } from 'react-coolicons';
import { Link } from 'react-router-dom';

function formatCount(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: value >= 10000 ? 1 : 0,
    notation: value >= 10000 ? 'compact' : 'standard'
  }).format(value);
}

interface FeedAction {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  countLabel?: string;
  pressed?: boolean;
  onClick?: () => void;
}

export function FeedActionRail({
  bookmarked,
  channelAvatarUrl,
  channelInitial,
  channelName,
  channelPath,
  disabled,
  liked,
  metrics,
  onBookmark,
  onComment,
  onLike,
  onShare
}: {
  bookmarked?: boolean;
  channelAvatarUrl?: string | null;
  channelInitial?: string;
  channelName?: string;
  channelPath?: string | null;
  disabled?: boolean;
  liked?: boolean;
  metrics: FeedItemMetrics;
  onBookmark?: () => void;
  onComment?: () => void;
  onLike?: () => void;
  onShare?: () => void;
}) {
  const actions: FeedAction[] = [
    {
      key: 'likes',
      label: liked ? '좋아요 취소' : '좋아요',
      icon: Heart,
      countLabel: formatCount(metrics.likes),
      onClick: onLike,
      pressed: liked
    },
    {
      key: 'comments',
      label: '댓글',
      icon: MessageCircle,
      countLabel: formatCount(metrics.comments),
      onClick: onComment
    },
    {
      key: 'bookmarks',
      label: bookmarked ? '즐겨찾기 취소' : '즐겨찾기',
      icon: Bookmark,
      countLabel: '즐겨찾기',
      onClick: onBookmark,
      pressed: bookmarked
    },
    {
      key: 'shares',
      label: '링크',
      icon: LinkIcon,
      countLabel: '링크',
      onClick: onShare
    }
  ].filter((action) => Boolean(action.onClick));

  return (
    <aside className="flex flex-col items-center gap-4">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            aria-label={action.label}
            aria-pressed={typeof action.pressed === 'boolean' ? action.pressed : undefined}
            className="group flex w-14 flex-col items-center gap-1 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] disabled:opacity-55"
            disabled={disabled}
            key={action.key}
            onClick={action.onClick}
            type="button"
          >
            <span
              className="flex h-8 w-8 items-center justify-center bg-transparent text-white transition group-hover:scale-105"
            >
              <Icon aria-hidden className={['h-6 w-6', action.pressed ? 'fill-current' : ''].join(' ')} />
            </span>
            <span className="text-[11px] font-semibold">{action.countLabel}</span>
          </button>
        );
      })}

      {channelInitial ? (
        channelPath ? (
          <Link
            aria-label={`${channelName ?? '채널'} 채널로 이동`}
            className="mt-1 flex h-10 w-10 items-center justify-center overflow-hidden bg-white/10 text-sm font-semibold text-white transition hover:bg-white/18"
            to={channelPath}
          >
            {channelAvatarUrl ? (
              <img alt="" className="h-full w-full object-cover" src={channelAvatarUrl} />
            ) : (
              channelInitial
            )}
          </Link>
        ) : (
          <div
            aria-label={channelName ?? '채널'}
            className="mt-1 flex h-10 w-10 items-center justify-center overflow-hidden bg-white/10 text-sm font-semibold text-white"
            role="img"
          >
            {channelAvatarUrl ? (
              <img alt="" className="h-full w-full object-cover" src={channelAvatarUrl} />
            ) : (
              channelInitial
            )}
          </div>
        )
      ) : null}
    </aside>
  );
}
