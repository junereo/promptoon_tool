import type { ChannelEpisode, ChannelSeries, ChannelShort } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftLg as ArrowLeft, Bell, Check, Play } from 'react-coolicons';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { channelApi } from '../../../shared/api/channel.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { formatChannelHandle } from '../lib/format-channel-handle';

function formatCompact(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: value >= 10000 ? 1 : 0,
    notation: value >= 10000 ? 'compact' : 'standard'
  }).format(value);
}

function formatDuration(durationSec: number) {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  if (minutes <= 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${String(seconds).padStart(2, '0')}초`;
}

function getSeriesStatusLabel(status: ChannelSeries['status']) {
  if (status === 'completed') {
    return '완결';
  }

  if (status === 'paused') {
    return '휴재';
  }

  if (status === 'draft') {
    return '준비중';
  }

  return '연재중';
}

function EpisodeCard({ episode }: { episode: ChannelEpisode }) {
  return (
    <Link className="group block overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]" to={`/v/${episode.publishId}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-white/10">
        {episode.thumbnailUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            src={episode.thumbnailUrl}
          />
        ) : null}
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          EP.{episode.episodeNo}
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-1 text-sm font-semibold text-white">{episode.title}</p>
        <p className="mt-1 text-xs leading-5 text-white/60">
          {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(episode.publishedAt))}
        </p>
      </div>
    </Link>
  );
}

function ShortCard({ short }: { short: ChannelShort }) {
  const content = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden bg-white/10">
        {short.thumbnailUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            src={short.thumbnailUrl}
          />
        ) : null}
        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {formatDuration(short.durationSec)}
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-1 text-sm font-semibold text-white">{short.title}</p>
        <p className="mt-1 text-xs leading-5 text-white/60">숏드라마</p>
      </div>
    </>
  );

  if (!short.publishId) {
    return <article className="block overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">{content}</article>;
  }

  return (
    <Link className="group block overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]" to={`/v/${short.publishId}`}>
      {content}
    </Link>
  );
}

function LegacyChannelPage() {
  const { channelId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const channelQuery = useQuery({
    enabled: Boolean(channelId),
    queryKey: promptoonKeys.channelHome(channelId),
    queryFn: () => channelApi.getChannelHome(channelId)
  });
  const home = channelQuery.data;
  const profile = home?.profile;
  const subscriptionQuery = useQuery({
    enabled: Boolean(isAuthenticated && profile?.id),
    queryKey: promptoonKeys.channelSubscription(profile?.id ?? ''),
    queryFn: () => channelApi.getSubscriptionState(profile!.id)
  });
  const isSubscribed = subscriptionQuery.data?.subscribed ?? false;
  const subscriberCount = subscriptionQuery.data?.subscriberCount ?? profile?.subscriberCount ?? 0;
  const subscribeMutation = useMutation({
    mutationFn: (input: { channelId: string; subscribed: boolean }) =>
      input.subscribed ? channelApi.unsubscribe(input.channelId) : channelApi.subscribe(input.channelId),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(channelId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelSubscription(input.channelId) })
      ]);
    }
  });

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
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center text-white/60">
        채널을 불러오는 중입니다.
      </main>
    );
  }

  if (channelQuery.isError || !home || !profile) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <p className="font-display text-3xl font-semibold">채널을 찾을 수 없습니다.</p>
          <Link className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-950" to="/discovery">
            피드로 이동
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#050506] pb-12 text-white">
      <section className="relative min-h-[25rem] overflow-hidden">
        {profile.bannerUrl ? (
          <img alt="" className="absolute inset-0 h-full w-full object-cover" src={profile.bannerUrl} />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#17191d,#221c24_48%,#050506)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.24),rgba(5,5,6,0.58)_48%,#050506_100%)]" />
        <div className="relative mx-auto flex min-h-[25rem] w-full max-w-6xl flex-col justify-between px-5 pb-8 pt-5 sm:px-8">
          <Link className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/15 backdrop-blur" to="/discovery">
            <ArrowLeft aria-hidden className="h-5 w-5" />
            <span className="sr-only">피드로 돌아가기</span>
          </Link>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white/15 text-3xl font-semibold text-white ring-2 ring-white/25">
                {profile.avatarUrl ? <img alt="" className="h-full w-full object-cover" src={profile.avatarUrl} /> : profile.displayName.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white/62">{formatChannelHandle(profile.handle ?? profile.slug)}</p>
                <h1 className="truncate font-display text-5xl font-semibold tracking-tight text-white">{profile.displayName}</h1>
                {profile.bio ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">{profile.bio}</p> : null}
              </div>
            </div>
            <button
              className={[
                'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition',
                isSubscribed ? 'bg-white/14 text-white ring-1 ring-white/20' : 'bg-white text-zinc-950 hover:bg-zinc-200'
              ].join(' ')}
              disabled={subscribeMutation.isPending}
              onClick={handleSubscribe}
              type="button"
            >
              {isSubscribed ? <Check aria-hidden className="h-4 w-4" /> : <Bell aria-hidden className="h-4 w-4" />}
              {isSubscribed ? '구독 중' : '구독'}
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <section className="grid grid-cols-3 gap-3 border-b border-white/10 pb-6">
          {[
            ['구독자', formatCompact(subscriberCount)],
            ['좋아요', formatCompact(profile.likeCount)],
            ['작품', formatCompact(profile.seriesCount + profile.episodeCount + profile.shortCount)]
          ].map(([label, value]) => (
            <div className="rounded-lg bg-white/[0.04] p-4" key={label}>
              <p className="text-xs text-white/45">{label}</p>
              <p className="mt-1 text-xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </section>

        <section className="py-9">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">대표 시리즈</h2>
          {home.featuredSeries.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {home.featuredSeries.map((series) => (
                <article className="grid overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] sm:grid-cols-[13rem_1fr]" key={series.id}>
                  <div className="min-h-48 bg-white/10">
                    {series.coverImageUrl ? <img alt="" className="h-full w-full object-cover" src={series.coverImageUrl} /> : null}
                  </div>
                  <div className="flex flex-col justify-between p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase text-white/50">{getSeriesStatusLabel(series.status)}</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{series.title}</h3>
                      {series.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/64">{series.description}</p> : null}
                    </div>
                    <Link
                      className="mt-6 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950"
                      to={`/c/${profile.slug}/series`}
                    >
                      <Play aria-hidden className="h-4 w-4 fill-current" />
                      {series.episodeCount}화 보기
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">대표 시리즈가 아직 없습니다.</p>
          )}
        </section>

        <div className="space-y-10">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white">숏드라마</h2>
              <Link className="text-sm font-medium text-white/58 transition hover:text-white" to={`/c/${profile.slug}/shorts`}>
                전체
              </Link>
            </div>
            {home.latestShorts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {home.latestShorts.map((short) => (
                  <ShortCard key={short.id} short={short} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">아직 공개된 숏드라마가 없습니다.</p>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-white">프롬툰</h2>
              <Link className="text-sm font-medium text-white/58 transition hover:text-white" to={`/c/${profile.slug}/series`}>
                전체
              </Link>
            </div>
            {home.latestEpisodes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {home.latestEpisodes.map((episode) => (
                  <EpisodeCard episode={episode} key={episode.id} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">아직 공개된 프롬툰이 없습니다.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export { CreatorChannelPage as ChannelPage } from './CreatorChannelPage';
