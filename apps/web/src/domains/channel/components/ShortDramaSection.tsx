import { Link } from 'react-router-dom';

import { ChannelEmptyState } from './ChannelEmptyState';
import { PromptoonEpisodeCard } from './PromptoonEpisodeCard';
import type { ChannelEpisodeCard, ChannelOwnerRelation } from '../model/channel.types';

interface ShortDramaSectionProps {
  channelSlug: string;
  episodes: ChannelEpisodeCard[];
  relation: ChannelOwnerRelation;
}

export function ShortDramaSection({ channelSlug, episodes, relation }: ShortDramaSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">숏드라마</h2>
        <Link className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-white/58 transition hover:text-white" to={`/c/${channelSlug}/shorts`}>
          전체 보기
        </Link>
      </div>
      {episodes.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {episodes.map((episode) => (
            <PromptoonEpisodeCard episode={episode} key={episode.id} />
          ))}
        </div>
      ) : (
        <ChannelEmptyState
          action={{
            href: relation === 'owner' ? '/promptoon/projects' : `/c/${channelSlug}`,
            kind: relation === 'owner' ? 'upload_short_drama' : 'notify',
            label: relation === 'owner' ? '첫 숏드라마 업로드' : '알림 받기'
          }}
          title="지금 공개된 숏드라마가 없어요"
          tone="short"
          subtitle="곧 새로운 숏드라마가 찾아올 예정이에요."
        />
      )}
    </section>
  );
}
