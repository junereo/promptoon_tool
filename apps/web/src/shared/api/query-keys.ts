import type { AnalyticsViewGranularity, AnalyticsViewRange } from '@promptoon/shared';

export const promptoonKeys = {
  feed: () => ['promptoon', 'feed'] as const,
  projects: () => ['promptoon', 'projects'] as const,
  episodeDraft: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'draft'] as const,
  latestPublishedEpisode: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'published', 'latest'] as const,
  publishedEpisode: (publishId: string) => ['promptoon', 'published', publishId] as const,
  episodeAnalyticsRoot: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'analytics'] as const,
  episodeAnalytics: (episodeId: string, viewsGranularity: AnalyticsViewGranularity, viewsRange?: AnalyticsViewRange) =>
    ['promptoon', 'episodes', episodeId, 'analytics', viewsGranularity, viewsRange?.from ?? null, viewsRange?.to ?? null] as const
};
