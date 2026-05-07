import { ArrowLeftLg as ArrowLeft, Link as LinkIcon } from 'react-coolicons';
import { Link } from 'react-router-dom';

import { ChannelCoverImage } from './ChannelCoverImage';
import { ChannelOwnerActions } from './ChannelOwnerActions';
import type { ChannelTheme } from '../model/channel-theme.types';
import type { ChannelProfile } from '../model/channel.types';

interface ChannelHeroProps {
  profile: ChannelProfile;
  theme: ChannelTheme;
  onEditCover: () => void;
  onShare: () => void;
}

export function ChannelHero({ profile, theme, onEditCover, onShare }: ChannelHeroProps) {
  return (
    <section className="relative z-0 mx-auto h-[248px] w-full overflow-hidden rounded-b-[28px] md:h-[336px] md:max-w-5xl md:rounded-b-[32px]">
      <ChannelCoverImage coverImage={profile.coverImage} displayName={profile.displayName} theme={theme} />
      <div className="absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6">
        <Link
          aria-label="피드로 돌아가기"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/38 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-black/55"
          to="/feed"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            aria-label="채널 공유"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/38 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-black/55"
            onClick={onShare}
            type="button"
          >
            <LinkIcon aria-hidden className="h-5 w-5" />
          </button>
          <button
            aria-label="채널 더보기"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-black/38 text-lg font-semibold leading-none text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-black/55"
            type="button"
          >
            ...
          </button>
        </div>
      </div>
      <ChannelOwnerActions isOwner={profile.relation === 'owner'} onEditCover={onEditCover} />
    </section>
  );
}
