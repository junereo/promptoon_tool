import { Link } from 'react-router-dom';

import type { ChannelContentTab } from '../model/channel.types';

interface ChannelTabsProps {
  activeTab: ChannelContentTab;
  channelSlug: string;
}

const CHANNEL_TABS: Array<{ key: ChannelContentTab; label: string; path: (channelSlug: string) => string }> = [
  { key: 'all', label: '전체', path: (channelSlug) => `/c/${channelSlug}` },
  { key: 'series', label: '시리즈', path: (channelSlug) => `/c/${channelSlug}/series` },
  { key: 'short_drama', label: '숏드라마', path: (channelSlug) => `/c/${channelSlug}/shorts` },
  { key: 'promptoon', label: '프롬툰', path: (channelSlug) => `/c/${channelSlug}/promptoons` }
];

export function ChannelTabs({ activeTab, channelSlug }: ChannelTabsProps) {
  return (
    <nav className="sticky top-0 z-20 -mx-4 overflow-x-auto border-y border-white/8 bg-[#050505]/78 px-4 py-3 backdrop-blur-xl">
      <div className="flex min-w-max gap-2">
        {CHANNEL_TABS.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={[
                'inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-5 text-sm font-semibold transition',
                isActive
                  ? 'border-white/22 bg-white text-zinc-950 shadow-lg shadow-white/10'
                  : 'border-white/10 bg-white/[0.045] text-white/70 hover:border-white/20 hover:bg-white/[0.075] hover:text-white'
              ].join(' ')}
              key={tab.key}
              to={tab.path(channelSlug)}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
