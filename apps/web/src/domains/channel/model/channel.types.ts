export type ChannelContentTab = 'all' | 'series' | 'short_drama' | 'promptoon';

export type ChannelOwnerRelation = 'owner' | 'subscriber' | 'guest';

export interface ChannelImageAsset {
  id: string;
  originalUrl: string;
  mobileUrl: string;
  desktopUrl: string;
  blurDataUrl: string | null;
  width: number;
  height: number;
  focalPointX: number;
  focalPointY: number;
  dominantColor: string | null;
}

export interface ChannelProfile {
  accountId: string | null;
  id: string;
  slug: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarImage: ChannelImageAsset | null;
  coverImage: ChannelImageAsset | null;
  subscriberCount: number;
  likeCount: number;
  workCount: number;
  relation: ChannelOwnerRelation;
}

export interface ChannelFeaturedSeries {
  id: string;
  title: string;
  subtitle: string | null;
  statusLabel: string;
  coverImageUrl: string | null;
  episodeCount: number;
  href: string;
}

export interface ChannelEpisodeCard {
  id: string;
  title: string;
  episodeLabel: string;
  publishedDateLabel: string;
  thumbnailUrl: string | null;
  href: string;
  isBookmarked: boolean;
}

export type EmptyStateActionKind = 'notify' | 'upload_short_drama' | 'create_promptoon';

export interface ChannelEmptyStateAction {
  kind: EmptyStateActionKind;
  label: string;
  href: string;
}

export interface ChannelPageData {
  profile: ChannelProfile;
  featuredSeries: ChannelFeaturedSeries[];
  shortDramaEpisodes: ChannelEpisodeCard[];
  promptoonEpisodes: ChannelEpisodeCard[];
}
