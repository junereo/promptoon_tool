import { Link } from 'react-router-dom';

import { ChannelEmptyState } from './ChannelEmptyState';
import { PromptoonEpisodeCard } from './PromptoonEpisodeCard';
import type { ChannelEpisodeCard, ChannelOwnerRelation } from '../model/channel.types';

interface PromptoonSectionProps {
  channelSlug: string;
  episodes: ChannelEpisodeCard[];
  relation: ChannelOwnerRelation;
}

export function PromptoonSection({ channelSlug, episodes, relation }: PromptoonSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">프롬툰</h2>
        <Link className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-white/58 transition hover:text-white" to={`/c/${channelSlug}/promptoons`}>
          전체 보기
        </Link>
      </div>
      {episodes.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 @[42rem]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
          {episodes.map((episode) => (
            <PromptoonEpisodeCard episode={episode} key={episode.id} />
          ))}
        </div>
      ) : (
        <ChannelEmptyState
          action={{
            href: relation === 'owner' ? '/promptoon/projects' : `/c/${channelSlug}`,
            kind: relation === 'owner' ? 'create_promptoon' : 'notify',
            label: relation === 'owner' ? '첫 프롬툰 만들기' : '업데이트 받기'
          }}
          title="아직 공개된 프롬툰이 없어요"
          tone="promptoon"
          subtitle="대표 에피소드가 공개되면 9:16 카드로 이곳에 진열됩니다."
        />
      )}
    </section>
  );
}
