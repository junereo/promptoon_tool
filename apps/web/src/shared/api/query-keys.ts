import type { AnalyticsViewGranularity, AnalyticsViewRange, CommunityDiscourseScope } from '@promptoon/shared';

export const promptoonKeys = {
  feed: () => ['promptoon', 'feed'] as const,
  feedHome: () => ['promptoon', 'feed', 'home'] as const,
  feedSearch: (query: string, type: string) => ['promptoon', 'feed', 'search', query, type] as const,
  feedBookmarks: () => ['promptoon', 'feed', 'bookmarks'] as const,
  landing: () => ['promptoon', 'landing'] as const,
  platformAccess: () => ['promptoon', 'platform-access'] as const,
  experimentalAccess: () => ['promptoon', 'experimental', 'access'] as const,
  experimentalFeed: () => ['promptoon', 'experimental', 'feed'] as const,
  feedInteractionStateRoot: () => ['promptoon', 'feed', 'state'] as const,
  feedInteractionState: (publishIdsKey: string) => ['promptoon', 'feed', 'state', publishIdsKey] as const,
  channelHome: (channelSlug: string) => ['promptoon', 'channel', channelSlug, 'home'] as const,
  myChannelHome: () => ['promptoon', 'me', 'channel', 'home'] as const,
  channelSubscription: (channelId: string) => ['promptoon', 'channel', channelId, 'subscription'] as const,
  projects: () => ['promptoon', 'projects'] as const,
  projectAssets: (projectId: string) => ['promptoon', 'projects', projectId, 'assets'] as const,
  projectPublishHistory: (projectId: string) => ['promptoon', 'projects', projectId, 'publishes'] as const,
  projectMembers: (projectId: string) => ['promptoon', 'projects', projectId, 'members'] as const,
  projectAnalytics: (projectId: string) => ['promptoon', 'projects', projectId, 'analytics'] as const,
  uploadQueue: () => ['promptoon', 'studio', 'uploads'] as const,
  episodeDraft: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'draft'] as const,
  latestPublishedEpisode: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'published', 'latest'] as const,
  episodeTestViewer: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'test-viewer'] as const,
  publishedEpisode: (publishId: string) => ['promptoon', 'published', publishId] as const,
  viewerInteractionState: (publishId: string) => ['promptoon', 'viewer', publishId, 'state'] as const,
  communityEmbed: (publishId: string) => ['promptoon', 'community', publishId, 'embed'] as const,
  communityComments: (publishId: string) => ['promptoon', 'community', publishId, 'comments'] as const,
  communityCommentsMeta: (publishId: string) => ['promptoon', 'community', publishId, 'comments-meta'] as const,
  communityDiscourseInteractionRoot: (publishId: string) => ['promptoon', 'community', publishId, 'discourse-interaction'] as const,
  communityDiscourseInteraction: (publishId: string, viewerKey: string) =>
    ['promptoon', 'community', publishId, 'discourse-interaction', viewerKey] as const,
  communityDiscourseComments: (publishId: string, scope: CommunityDiscourseScope) =>
    ['promptoon', 'community', publishId, 'discourse-comments', scope] as const,
  episodeAnalyticsRoot: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'analytics'] as const,
  episodeAnalytics: (episodeId: string, viewsGranularity: AnalyticsViewGranularity, viewsRange?: AnalyticsViewRange) =>
    ['promptoon', 'episodes', episodeId, 'analytics', viewsGranularity, viewsRange?.from ?? null, viewsRange?.to ?? null] as const
};
