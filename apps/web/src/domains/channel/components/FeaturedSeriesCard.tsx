import { Play } from 'react-coolicons';
import { Link } from 'react-router-dom';

import type { ChannelFeaturedSeries } from '../model/channel.types';

interface FeaturedSeriesCardProps {
  series: ChannelFeaturedSeries;
}

export function FeaturedSeriesCard({ series }: FeaturedSeriesCardProps) {
  return (
    <article className="group relative min-w-[82vw] snap-start overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.065] shadow-2xl shadow-black/24 sm:min-w-[25rem] md:min-w-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(245,184,91,0.18),transparent_34%)]" />
      {series.coverImageUrl ? (
        <img
          alt={`${series.title} series cover`}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          src={series.coverImageUrl}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/48 to-black/8" />
      <div className="relative flex min-h-[20rem] flex-col justify-end p-5">
        <span className="mb-3 w-fit rounded-full border border-white/18 bg-black/42 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {series.statusLabel}
        </span>
        <h3 className="font-display text-3xl font-semibold tracking-tight text-white">{series.title}</h3>
        {series.subtitle ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/70">{series.subtitle}</p> : null}
        <Link
          className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          to={series.href}
        >
          <Play aria-hidden className="h-4 w-4 fill-current" />
          {series.episodeCount}화 보기
        </Link>
      </div>
    </article>
  );
}
