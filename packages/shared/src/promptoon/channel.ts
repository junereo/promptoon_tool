export interface ChannelProfile {
  id: string;
  slug: string;
  displayName: string;
  handle?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  isVerified: boolean;
  subscriberCount: number;
  likeCount: number;
  seriesCount: number;
  episodeCount: number;
  shortCount: number;
}

export interface ChannelSeries {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  coverImageUrl?: string | null;
  episodeCount: number;
  status: 'draft' | 'ongoing' | 'completed' | 'paused';
}

export interface ChannelEpisode {
  id: string;
  publishId: string;
  title: string;
  episodeNo: number;
  thumbnailUrl?: string | null;
  publishedAt: string;
}

export interface ChannelShort {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  durationSec: number;
  publishId?: string | null;
}

export interface ChannelCommunityMeta {
  commentCount: number;
  latestCommentAt?: string | null;
}

export interface ChannelSubscriptionStateResponse {
  channelId: string;
  subscribed: boolean;
  subscriberCount: number;
}

export interface ChannelHome {
  profile: ChannelProfile;
  featuredSeries: ChannelSeries[];
  latestEpisodes: ChannelEpisode[];
  latestShorts: ChannelShort[];
  communityMeta?: ChannelCommunityMeta;
}
