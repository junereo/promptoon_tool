export interface RelatedShort {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  durationSec: number;
  href: string;
}

export interface CommentsMeta {
  commentCount: number;
  latestCommentAt?: string | null;
  discussionUrl?: string | null;
}

export interface ViewerInteractionStateResponse {
  publishId: string;
  liked: boolean;
  bookmarked: boolean;
  metrics: import('./feed').FeedItemMetrics;
  channelId?: string | null;
  subscribedToChannel?: boolean;
}

export type { ProductPublish, ProductPublishManifest } from './core';
export type { Publish, PublishManifest } from './legacy';
