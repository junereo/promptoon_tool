import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { channelApi } from '../../../shared/api/channel.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { telemetryApi } from '../../../shared/api/telemetry.api';
import { formatChannelHandle } from '../lib/format-channel-handle';

type ChannelTab = 'home' | 'series' | 'shorts' | 'community';

const CHANNEL_TABS: Array<{ key: ChannelTab; label: string; getPath: (channelSlug: string) => string }> = [
  { key: 'home', label: '홈', getPath: (channelSlug) => `/c/${channelSlug}` },
  { key: 'series', label: '시리즈', getPath: (channelSlug) => `/c/${channelSlug}/series` },
  { key: 'shorts', label: '숏드라마', getPath: (channelSlug) => `/c/${channelSlug}/shorts` },
  { key: 'community', label: '커뮤니티', getPath: (channelSlug) => `/c/${channelSlug}/community` }
];

function formatCompact(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: value >= 10000 ? 1 : 0,
    notation: value >= 10000 ? 'compact' : 'standard'
  }).format(value);
}

function getActiveChannelTab(pathname: string): ChannelTab {
  if (pathname.endsWith('/series')) {
    return 'series';
  }

  if (pathname.endsWith('/shorts')) {
    return 'shorts';
  }

  if (pathname.endsWith('/community')) {
    return 'community';
  }

  return 'home';
}

function LegacyChannelHomePage() {
  const { channelSlug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const channelQuery = useQuery({
    enabled: Boolean(channelSlug),
    queryKey: promptoonKeys.channelHome(channelSlug),
    queryFn: () => channelApi.getChannelHome(channelSlug)
  });

  const home = channelQuery.data;
  const profile = home?.profile;
  const activeTab = getActiveChannelTab(location.pathname);
  const shouldShowSeries = activeTab === 'home' || activeTab === 'series';
  const shouldShowEpisodes = activeTab === 'home' || activeTab === 'series';
  const shouldShowShorts = activeTab === 'home' || activeTab === 'shorts';
  const shouldShowCommunity = activeTab === 'home' || activeTab === 'community';
  const subscriptionQuery = useQuery({
    enabled: Boolean(isAuthenticated && profile?.id),
    queryKey: promptoonKeys.channelSubscription(profile?.id ?? ''),
    queryFn: () => channelApi.getSubscriptionState(profile!.id)
  });
  const isSubscribed = subscriptionQuery.data?.subscribed ?? false;
  const subscribeMutation = useMutation({
    mutationFn: (input: { channelId: string; subscribed: boolean }) =>
      input.subscribed ? channelApi.unsubscribe(input.channelId) : channelApi.subscribe(input.channelId),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(channelSlug) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelSubscription(input.channelId) })
      ]);
    }
  });

  useEffect(() => {
    if (!profile) {
      return;
    }

    void telemetryApi.trackEvent({
      eventName: 'channel_view',
      channelId: profile.id,
      payload: {
        slug: profile.slug
      }
    }).catch(() => undefined);
  }, [profile]);

  function handleSubscribe() {
    if (!profile) {
      return;
    }

    if (!user || !isAuthenticated) {
      navigate('/login', {
        state: {
          from: `${location.pathname}${location.search}`
        }
      });
      return;
    }

    void subscribeMutation.mutateAsync({
      channelId: profile.id,
      subscribed: isSubscribed
    }).catch(() => undefined);
  }

  if (channelQuery.isLoading) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#08090b] text-zinc-400">채널을 불러오는 중입니다.</main>;
  }

  if (channelQuery.isError || !home || !profile) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#08090b] px-6 text-center text-zinc-400">채널을 찾을 수 없습니다.</main>;
  }

  return (
    <main className="min-h-dvh bg-[#08090b] text-zinc-50">
      <section className="relative min-h-[22rem] overflow-hidden">
        {profile.bannerUrl ? (
          <img alt="" className="absolute inset-0 h-full w-full object-cover" src={profile.bannerUrl} />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#191b1f,#2a1f29_48%,#0b0f12)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-[#08090b]/45 to-black/10" />
        <div className="relative mx-auto flex min-h-[22rem] w-full max-w-6xl flex-col justify-end px-5 pb-7 pt-16 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-2xl font-semibold">
                {profile.avatarUrl ? <img alt="" className="h-full w-full object-cover" src={profile.avatarUrl} /> : profile.displayName.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white/65">{formatChannelHandle(profile.handle ?? profile.slug)}</p>
                <h1 className="truncate font-display text-4xl font-semibold tracking-tight">{profile.displayName}</h1>
                {profile.bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">{profile.bio}</p> : null}
              </div>
            </div>
            <button
              className="h-11 rounded-xl bg-editor-accent px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
              disabled={subscribeMutation.isPending}
              onClick={handleSubscribe}
              type="button"
            >
              {isSubscribed ? '구독 중' : '구독'}
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 px-5 py-5 sm:grid-cols-5 sm:px-8">
        {[
          ['구독자', profile.subscriberCount],
          ['좋아요', profile.likeCount],
          ['시리즈', profile.seriesCount],
          ['에피소드', profile.episodeCount],
          ['숏드라마', profile.shortCount]
        ].map(([label, value]) => (
          <div className="border-b border-white/10 py-3" key={label}>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold">{formatCompact(Number(value))}</p>
          </div>
        ))}
      </section>

      <nav className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-5 pb-4 sm:px-8">
        {CHANNEL_TABS.map((tab) => (
          <Link
            aria-current={tab.key === activeTab ? 'page' : undefined}
            className={[
              'inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm transition',
              tab.key === activeTab
                ? 'border-editor-accentSoft bg-editor-accent/20 text-white'
                : 'border-white/10 text-zinc-300 hover:border-white/25 hover:text-white'
            ].join(' ')}
            key={tab.key}
            to={tab.getPath(profile.slug)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section
        className={[
          'mx-auto grid w-full max-w-6xl gap-8 px-5 pb-12 sm:px-8',
          activeTab === 'home' ? 'lg:grid-cols-[1.2fr_0.8fr]' : ''
        ].join(' ')}
      >
        {shouldShowSeries || shouldShowEpisodes ? (
          <div>
            {shouldShowSeries ? (
              <section>
                <h2 className="font-display text-2xl font-semibold">대표 시리즈</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {home.featuredSeries.map((series) => (
                    <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]" key={series.id}>
                      {series.coverImageUrl ? <img alt="" className="aspect-[16/9] w-full object-cover" src={series.coverImageUrl} /> : null}
                      <div className="p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-editor-accentSoft">{series.status}</p>
                        <h3 className="mt-2 text-lg font-semibold">{series.title}</h3>
                        <p className="mt-2 text-sm text-zinc-400">{series.episodeCount} episodes</p>
                      </div>
                    </article>
                  ))}
                  {home.featuredSeries.length === 0 ? <p className="text-sm text-zinc-500">대표 시리즈가 아직 없습니다.</p> : null}
                </div>
              </section>
            ) : null}

            {shouldShowEpisodes ? (
              <section className={shouldShowSeries ? 'mt-10' : undefined}>
                <h2 className="font-display text-2xl font-semibold">최신 에피소드</h2>
                <div className="mt-4 grid gap-3">
                  {home.latestEpisodes.map((episode) => (
                    <Link className="flex items-center gap-4 border-b border-white/10 py-3 transition hover:border-white/25" key={episode.id} to={`/v/${episode.publishId}`}>
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-white/10">
                        {episode.thumbnailUrl ? <img alt="" className="h-full w-full object-cover" src={episode.thumbnailUrl} /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">EP.{episode.episodeNo}</p>
                        <p className="truncate font-medium">{episode.title}</p>
                      </div>
                    </Link>
                  ))}
                  {home.latestEpisodes.length === 0 ? <p className="text-sm text-zinc-500">발행된 에피소드가 아직 없습니다.</p> : null}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {shouldShowShorts || shouldShowCommunity ? (
          <aside className="space-y-8">
            {shouldShowShorts ? (
              <section>
                <h2 className="font-display text-2xl font-semibold">숏드라마</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {home.latestShorts.map((short) => (
                    <Link className="block overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]" key={short.id} to={short.publishId ? `/v/${short.publishId}` : `/c/${profile.slug}/shorts`}>
                      <div className="aspect-[9/13] bg-white/10">
                        {short.thumbnailUrl ? <img alt="" className="h-full w-full object-cover" src={short.thumbnailUrl} /> : null}
                      </div>
                      <p className="truncate px-3 py-2 text-sm">{short.title}</p>
                    </Link>
                  ))}
                  {home.latestShorts.length === 0 ? <p className="text-sm text-zinc-500">등록된 숏드라마가 없습니다.</p> : null}
                </div>
              </section>
            ) : null}

            {shouldShowCommunity ? (
              <section className={shouldShowShorts ? 'border-t border-white/10 pt-6' : undefined}>
                <h2 className="font-display text-2xl font-semibold">커뮤니티</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  댓글 {formatCompact(home.communityMeta?.commentCount ?? 0)}개
                </p>
              </section>
            ) : null}
          </aside>
        ) : null}
      </section>
    </main>
  );
}

export { CreatorChannelPage as ChannelHomePage } from './CreatorChannelPage';
