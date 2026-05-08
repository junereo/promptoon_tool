import { Bell, Check, EditPencilLine01 as Pencil } from 'react-coolicons';

import type { ChannelProfile } from '../model/channel.types';
import { formatChannelHandle } from '../lib/format-channel-handle';

interface ChannelIdentityProps {
  isSubscribePending: boolean;
  isSubscribed: boolean;
  onEditAvatar: () => void;
  onEditProfile: () => void;
  onSubscribe: () => void;
  profile: ChannelProfile;
}

export function ChannelIdentity({
  isSubscribePending,
  isSubscribed,
  onEditAvatar,
  onEditProfile,
  onSubscribe,
  profile
}: ChannelIdentityProps) {
  const avatarFallback = profile.displayName.trim().slice(0, 1).toUpperCase() || 'P';
  const fallbackAccountId = profile.handle.replace(/^@/, '') || profile.slug;
  const accountId = formatChannelHandle(profile.accountId ?? fallbackAccountId);

  return (
    <section className="relative z-30 -mt-16 flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[30px] border border-white/16 bg-white/12 text-4xl font-semibold text-white shadow-2xl shadow-black/35 ring-4 ring-[#050505]">
          {profile.avatarImage ? (
            <img alt={`${profile.displayName} avatar`} className="h-full w-full object-cover" src={profile.avatarImage.mobileUrl} />
          ) : (
            avatarFallback
          )}
          {profile.relation === 'owner' ? (
            <button
              aria-label="프로필 아이콘 변경"
              className="absolute bottom-2 right-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-black/58 text-white shadow-lg shadow-black/25 backdrop-blur transition hover:bg-black/72"
              onClick={onEditAvatar}
              type="button"
            >
              <Pencil aria-hidden className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="min-w-0 pb-1">
          <p className="text-sm font-medium text-white/56">{accountId}</p>
          <h1 className="mt-1 truncate font-display text-4xl font-semibold tracking-tight text-white">
            {profile.displayName}
          </h1>
          {profile.bio ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">{profile.bio}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {profile.relation === 'owner' ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 bg-white/8 px-5 text-sm font-semibold text-white transition hover:bg-white/12"
            onClick={onEditProfile}
            type="button"
          >
            프로필 편집
          </button>
        ) : null}
        <button
          className={[
            'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-70',
            isSubscribed ? 'border border-white/14 bg-white/10 text-white hover:bg-white/14' : 'bg-white text-zinc-950 hover:bg-zinc-200'
          ].join(' ')}
          disabled={isSubscribePending}
          onClick={onSubscribe}
          type="button"
        >
          {isSubscribed ? <Check aria-hidden className="h-4 w-4" /> : <Bell aria-hidden className="h-4 w-4" />}
          {isSubscribed ? '구독 중' : '구독'}
        </button>
      </div>
    </section>
  );
}
