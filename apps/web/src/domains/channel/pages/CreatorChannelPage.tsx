import type { ChannelEpisode, ChannelHome, ChannelSeries, ChannelShort } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ChannelHero } from '../components/ChannelHero';
import { ChannelIdentity } from '../components/ChannelIdentity';
import { ChannelStats } from '../components/ChannelStats';
import { ChannelTabs } from '../components/ChannelTabs';
import { FeaturedSeriesSection } from '../components/FeaturedSeriesSection';
import { PromptoonSection } from '../components/PromptoonSection';
import { ShortDramaSection } from '../components/ShortDramaSection';
import { EditChannelAvatarDialog } from '../dialogs/EditChannelAvatarDialog';
import { EditChannelCoverDialog } from '../dialogs/EditChannelCoverDialog';
import { EditChannelProfileDialog } from '../dialogs/EditChannelProfileDialog';
import { formatChannelHandle } from '../lib/format-channel-handle';
import { getChannelTheme } from '../lib/get-channel-theme';
import type {
  ChannelContentTab,
  ChannelEpisodeCard,
  ChannelFeaturedSeries,
  ChannelImageAsset,
  ChannelOwnerRelation,
  ChannelPageData,
  ChannelProfile
} from '../model/channel.types';
import { FeedBottomNav } from '../../feed/components/FeedBottomNav';
import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { channelApi } from '../../../shared/api/channel.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { telemetryApi } from '../../../shared/api/telemetry.api';

function getActiveContentTab(pathname: string): ChannelContentTab {
  if (pathname.endsWith('/series')) {
    return 'series';
  }

  if (pathname.endsWith('/shorts')) {
    return 'short_drama';
  }

  if (pathname.endsWith('/promptoons')) {
    return 'promptoon';
  }

  return 'all';
}

function getSeriesStatusLabel(status: ChannelSeries['status']): string {
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

function createImageAsset(input: {
  id: string;
  url?: string | null;
  width: number;
  height: number;
  dominantColor?: string | null;
}): ChannelImageAsset | null {
  if (!input.url) {
    return null;
  }

  return {
    id: input.id,
    originalUrl: input.url,
    mobileUrl: input.url,
    desktopUrl: input.url,
    blurDataUrl: null,
    width: input.width,
    height: input.height,
    focalPointX: 50,
    focalPointY: 50,
    dominantColor: input.dominantColor ?? null
  };
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function formatDurationLabel(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function mapFeaturedSeries(profile: ChannelHome['profile'], series: ChannelSeries): ChannelFeaturedSeries {
  return {
    id: series.id,
    title: series.title,
    subtitle: series.description ?? null,
    statusLabel: getSeriesStatusLabel(series.status),
    coverImageUrl: series.coverImageUrl ?? null,
    episodeCount: series.episodeCount,
    href: `/c/${profile.slug}/series`
  };
}

function mapPromptoonEpisode(episode: ChannelEpisode): ChannelEpisodeCard {
  return {
    id: episode.id,
    title: episode.title,
    episodeLabel: `EP.${episode.episodeNo}`,
    publishedDateLabel: formatDateLabel(episode.publishedAt),
    thumbnailUrl: episode.thumbnailUrl ?? null,
    href: `/v/${episode.publishId}`,
    isBookmarked: false
  };
}

function mapShortDramaEpisode(short: ChannelShort): ChannelEpisodeCard {
  return {
    id: short.id,
    title: short.title,
    episodeLabel: formatDurationLabel(short.durationSec),
    publishedDateLabel: '숏드라마',
    thumbnailUrl: short.thumbnailUrl ?? null,
    href: short.publishId ? `/shorts/${short.publishId}` : '#',
    isBookmarked: false
  };
}

function mapChannelHomeToPageData(
  home: ChannelHome,
  relation: ChannelOwnerRelation,
  subscriberCountOverride?: number
): ChannelPageData {
  const profile: ChannelProfile = {
    accountId: home.profile.ownerLoginId ?? null,
    id: home.profile.id,
    slug: home.profile.slug,
    handle: formatChannelHandle(home.profile.handle ?? home.profile.slug),
    displayName: home.profile.displayName,
    bio: home.profile.bio ?? null,
    avatarImage: createImageAsset({
      id: `${home.profile.id}-avatar`,
      url: home.profile.avatarUrl,
      width: 512,
      height: 512
    }),
    coverImage: createImageAsset({
      id: `${home.profile.id}-cover`,
      url: home.profile.bannerUrl,
      width: 2400,
      height: 900,
      dominantColor: '#f5b85b'
    }),
    subscriberCount: subscriberCountOverride ?? home.profile.subscriberCount,
    likeCount: home.profile.likeCount,
    workCount: home.profile.seriesCount + home.profile.episodeCount + home.profile.shortCount,
    relation
  };

  return {
    profile,
    featuredSeries: home.featuredSeries.map((series) => mapFeaturedSeries(home.profile, series)),
    shortDramaEpisodes: home.latestShorts.map(mapShortDramaEpisode),
    promptoonEpisodes: home.latestEpisodes.map(mapPromptoonEpisode)
  };
}

function ChannelPageSkeleton() {
  return (
    <main className="min-h-dvh bg-[#050505] text-white">
      <p className="sr-only">채널을 불러오는 중입니다.</p>
      <div className="h-[248px] animate-pulse rounded-b-[28px] bg-white/[0.055] md:mx-auto md:mt-5 md:h-[336px] md:max-w-5xl md:rounded-[32px]" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-28">
        <div className="-mt-16 h-28 w-28 animate-pulse rounded-[30px] bg-white/10 ring-4 ring-[#050505]" />
        <div className="h-28 animate-pulse rounded-[28px] bg-white/[0.045]" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-20 animate-pulse rounded-[22px] bg-white/[0.045]" />
          <div className="h-20 animate-pulse rounded-[22px] bg-white/[0.045]" />
          <div className="h-20 animate-pulse rounded-[22px] bg-white/[0.045]" />
        </div>
      </div>
    </main>
  );
}

export function CreatorChannelPage() {
  const { channelId, channelSlug } = useParams();
  const channelKey = channelSlug ?? channelId ?? '';
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const activeTab = getActiveContentTab(location.pathname);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  const channelQuery = useQuery({
    enabled: Boolean(channelKey),
    queryKey: promptoonKeys.channelHome(channelKey),
    queryFn: () => channelApi.getChannelHome(channelKey)
  });

  const home = channelQuery.data;
  const sourceProfile = home?.profile;
  const subscriptionQuery = useQuery({
    enabled: Boolean(isAuthenticated && sourceProfile?.id),
    queryKey: promptoonKeys.channelSubscription(sourceProfile?.id ?? ''),
    queryFn: () => channelApi.getSubscriptionState(sourceProfile!.id)
  });
  const myChannelQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: promptoonKeys.myChannelHome(),
    queryFn: () => channelApi.getMyChannelHome()
  });
  const isSubscribed = subscriptionQuery.data?.subscribed ?? false;
  const isOwner = Boolean(sourceProfile && myChannelQuery.data?.profile.id === sourceProfile.id);
  const relation: ChannelOwnerRelation = isOwner ? 'owner' : isSubscribed ? 'subscriber' : 'guest';

  const pageData = useMemo(
    () => home ? mapChannelHomeToPageData(home, relation, subscriptionQuery.data?.subscriberCount) : null,
    [home, relation, subscriptionQuery.data?.subscriberCount]
  );

  const subscribeMutation = useMutation({
    mutationFn: (input: { channelId: string; subscribed: boolean }) =>
      input.subscribed ? channelApi.unsubscribe(input.channelId) : channelApi.subscribe(input.channelId),
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(channelKey) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelSubscription(input.channelId) })
      ]);
    }
  });
  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => channelApi.uploadMyChannelCover(file),
    onSuccess: async (data) => {
      queryClient.setQueryData(promptoonKeys.myChannelHome(), data.home);
      queryClient.setQueryData(promptoonKeys.channelHome(data.home.profile.slug), data.home);
      if (channelKey && channelKey !== data.home.profile.slug) {
        queryClient.setQueryData(promptoonKeys.channelHome(channelKey), data.home);
      }
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(data.home.profile.slug) });
    }
  });
  const deleteCoverMutation = useMutation({
    mutationFn: () => channelApi.deleteMyChannelCover(),
    onSuccess: async (data) => {
      queryClient.setQueryData(promptoonKeys.myChannelHome(), data.home);
      queryClient.setQueryData(promptoonKeys.channelHome(data.home.profile.slug), data.home);
      if (channelKey && channelKey !== data.home.profile.slug) {
        queryClient.setQueryData(promptoonKeys.channelHome(channelKey), data.home);
      }
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(data.home.profile.slug) });
    }
  });
  const updateProfileMutation = useMutation({
    mutationFn: (payload: { bio: string | null; displayName: string }) => channelApi.updateMyChannelProfile(payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(promptoonKeys.myChannelHome(), data.home);
      queryClient.setQueryData(promptoonKeys.channelHome(data.home.profile.slug), data.home);
      if (channelKey && channelKey !== data.home.profile.slug) {
        queryClient.setQueryData(promptoonKeys.channelHome(channelKey), data.home);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(data.home.profile.slug) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
    }
  });
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => channelApi.uploadMyChannelAvatar(file),
    onSuccess: async (data) => {
      queryClient.setQueryData(promptoonKeys.myChannelHome(), data.home);
      queryClient.setQueryData(promptoonKeys.channelHome(data.home.profile.slug), data.home);
      if (channelKey && channelKey !== data.home.profile.slug) {
        queryClient.setQueryData(promptoonKeys.channelHome(channelKey), data.home);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(data.home.profile.slug) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
    }
  });
  const deleteAvatarMutation = useMutation({
    mutationFn: () => channelApi.deleteMyChannelAvatar(),
    onSuccess: async (data) => {
      queryClient.setQueryData(promptoonKeys.myChannelHome(), data.home);
      queryClient.setQueryData(promptoonKeys.channelHome(data.home.profile.slug), data.home);
      if (channelKey && channelKey !== data.home.profile.slug) {
        queryClient.setQueryData(promptoonKeys.channelHome(channelKey), data.home);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.channelHome(data.home.profile.slug) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
    }
  });

  useEffect(() => {
    if (!sourceProfile) {
      return;
    }

    void telemetryApi.trackEvent({
      eventName: 'channel_view',
      channelId: sourceProfile.id,
      payload: {
        slug: sourceProfile.slug
      }
    }).catch(() => undefined);
  }, [sourceProfile]);

  function handleSubscribe() {
    if (!sourceProfile) {
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
      channelId: sourceProfile.id,
      subscribed: isSubscribed
    }).catch(() => undefined);
  }

  function handleShare() {
    if (!pageData) {
      return;
    }

    const shareUrl = window.location.href;
    if (typeof navigator.share === 'function') {
      void navigator.share({
        title: pageData.profile.displayName,
        text: pageData.profile.bio ?? pageData.profile.handle,
        url: shareUrl
      }).catch(() => undefined);
      return;
    }

    void navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
  }

  if (channelQuery.isLoading) {
    return <ChannelPageSkeleton />;
  }

  if (channelQuery.isError || !pageData) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#050505] px-6 text-center text-white">
        <div>
          <p className="font-display text-3xl font-semibold">채널을 찾을 수 없습니다.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-950" to="/discovery">
            피드로 이동
          </Link>
        </div>
      </main>
    );
  }

  const theme = getChannelTheme(pageData.profile);
  const shouldShowSeries = activeTab === 'all' || activeTab === 'series';
  const shouldShowShorts = activeTab === 'all' || activeTab === 'short_drama';
  const shouldShowPromptoons = activeTab === 'all' || activeTab === 'promptoon';

  return (
    <main className="min-h-dvh bg-[#050505] text-white">
      <ChannelHero
        onEditCover={() => setIsCoverDialogOpen(true)}
        onShare={handleShare}
        profile={pageData.profile}
        theme={theme}
      />
      <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-28 pt-0 md:px-6 md:pt-6">
        <ChannelIdentity
          isSubscribed={isSubscribed}
          isSubscribePending={subscribeMutation.isPending}
          onEditAvatar={() => setIsAvatarDialogOpen(true)}
          onEditProfile={() => setIsProfileDialogOpen(true)}
          onSubscribe={handleSubscribe}
          profile={pageData.profile}
        />
        <ChannelStats profile={pageData.profile} />
        <ChannelTabs activeTab={activeTab} channelSlug={pageData.profile.slug} />
        <div className="[container-type:inline-size]">
          <div className="flex flex-col gap-10">
            {shouldShowSeries ? <FeaturedSeriesSection channelSlug={pageData.profile.slug} series={pageData.featuredSeries} /> : null}
            {shouldShowShorts ? (
              <ShortDramaSection
                channelSlug={pageData.profile.slug}
                episodes={pageData.shortDramaEpisodes}
                relation={pageData.profile.relation}
              />
            ) : null}
            {shouldShowPromptoons ? (
              <PromptoonSection
                channelSlug={pageData.profile.slug}
                episodes={pageData.promptoonEpisodes}
                relation={pageData.profile.relation}
              />
            ) : null}
          </div>
        </div>
      </div>
      <EditChannelCoverDialog
        isDeleting={deleteCoverMutation.isPending}
        isOpen={isCoverDialogOpen}
        isUploading={uploadCoverMutation.isPending}
        onClose={() => setIsCoverDialogOpen(false)}
        onDelete={async () => {
          await deleteCoverMutation.mutateAsync();
        }}
        onUpload={async (file) => {
          await uploadCoverMutation.mutateAsync(file);
        }}
        profile={pageData.profile}
      />
      <EditChannelAvatarDialog
        isDeleting={deleteAvatarMutation.isPending}
        isOpen={isAvatarDialogOpen}
        isUploading={uploadAvatarMutation.isPending}
        onClose={() => setIsAvatarDialogOpen(false)}
        onDelete={async () => {
          await deleteAvatarMutation.mutateAsync();
        }}
        onUpload={async (file) => {
          await uploadAvatarMutation.mutateAsync(file);
        }}
        profile={pageData.profile}
      />
      <EditChannelProfileDialog
        isOpen={isProfileDialogOpen}
        isSaving={updateProfileMutation.isPending}
        onClose={() => setIsProfileDialogOpen(false)}
        onSave={async (payload) => {
          await updateProfileMutation.mutateAsync(payload);
        }}
        profile={pageData.profile}
      />
      <FeedBottomNav isAuthenticated={isAuthenticated} isVisible userLoginId={user?.loginId} />
    </main>
  );
}
