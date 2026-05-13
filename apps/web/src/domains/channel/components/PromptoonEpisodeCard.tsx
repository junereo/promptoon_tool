import { Bookmark } from 'react-coolicons';
import { Link } from 'react-router-dom';

import type { ChannelEpisodeCard } from '../model/channel.types';

interface PromptoonEpisodeCardProps {
  episode: ChannelEpisodeCard;
}

export function PromptoonEpisodeCard({ episode }: PromptoonEpisodeCardProps) {
  return (
    <Link className="group block min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.055] shadow-lg shadow-black/12 transition active:scale-[0.98]" to={episode.href}>
      <div className="relative aspect-[9/16] overflow-hidden bg-white/10">
        {episode.thumbnailUrl ? (
          <img
            alt={`${episode.title} thumbnail`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            src={episode.thumbnailUrl}
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,rgba(245,184,91,0.18),rgba(255,255,255,0.06),rgba(0,0,0,0.35))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-transparent to-black/20" />
        <span className="absolute left-3 top-3 rounded-full bg-black/52 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {episode.episodeLabel}
        </span>
        <span className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/42 text-white backdrop-blur">
          <Bookmark aria-hidden className={episode.isBookmarked ? 'h-5 w-5 fill-current' : 'h-5 w-5'} />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{episode.title}</h3>
          <p className="mt-1 text-xs text-white/62">{episode.publishedDateLabel}</p>
        </div>
      </div>
    </Link>
  );
}
