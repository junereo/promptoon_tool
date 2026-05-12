import type { FeedItem, FeedItemType } from '@promptoon/shared';
import { Link } from 'react-router-dom';

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

export function ConsumerContentCard({ item, rank }: { item: FeedItem; rank?: number }) {
  const posterUrl = getPosterUrl(item);

  return (
    <Link className="group block min-w-0" to={getConsumerContentHref(item)}>
      <article className="min-w-0">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-900">
          {posterUrl ? (
            <img
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              src={posterUrl}
            />
          ) : (
            <div className="h-full w-full bg-black" />
          )}
          {rank ? (
            <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-md bg-white px-2 text-xs font-black text-zinc-950">
              {rank}
            </span>
          ) : null}
          <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {getTypeLabel(item)}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white">{item.episodeTitle}</h3>
        <p className="mt-0.5 truncate text-xs text-white/48">{item.projectTitle}</p>
      </article>
    </Link>
  );
}
