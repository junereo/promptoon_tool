import { formatChannelCount } from '../lib/format-channel-count';
import type { ChannelProfile } from '../model/channel.types';

interface ChannelStatsProps {
  profile: ChannelProfile;
}

export function ChannelStats({ profile }: ChannelStatsProps) {
  const stats = [
    { label: '구독자', value: profile.subscriberCount },
    { label: '좋아요', value: profile.likeCount },
    { label: '작품', value: profile.workCount }
  ];

  return (
    <section className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.065] p-4 shadow-lg shadow-black/10 backdrop-blur" key={stat.label}>
          <p className="text-xs font-medium text-white/48">{stat.label}</p>
          <p className="mt-1 break-words font-display text-2xl font-semibold tracking-tight text-white">
            {formatChannelCount(stat.value)}
          </p>
        </div>
      ))}
    </section>
  );
}
