import { Link } from 'react-router-dom';

import { ChannelEmptyState } from './ChannelEmptyState';
import { FeaturedSeriesCard } from './FeaturedSeriesCard';
import type { ChannelFeaturedSeries } from '../model/channel.types';

interface FeaturedSeriesSectionProps {
  channelSlug: string;
  series: ChannelFeaturedSeries[];
}

export function FeaturedSeriesSection({ channelSlug, series }: FeaturedSeriesSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">대표 시리즈</h2>
        <Link className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-white/58 transition hover:text-white" to={`/c/${channelSlug}/series`}>
          전체 보기
        </Link>
      </div>
      {series.length > 0 ? (
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
          {series.map((item) => (
            <FeaturedSeriesCard key={item.id} series={item} />
          ))}
        </div>
      ) : (
        <ChannelEmptyState
          action={{
            href: `/studio/projects`,
            kind: 'create_promptoon',
            label: '첫 시리즈 만들기'
          }}
          title="대표 시리즈가 아직 없습니다"
          tone="series"
          subtitle="곧 이 채널의 대표 프롬툰이 이 영역에서 크게 소개됩니다."
        />
      )}
    </section>
  );
}
