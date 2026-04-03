export const promptoonKeys = {
  feed: () => ['promptoon', 'feed'] as const,
  projects: () => ['promptoon', 'projects'] as const,
  episodeDraft: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'draft'] as const,
  latestPublishedEpisode: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'published', 'latest'] as const,
  publishedEpisode: (publishId: string) => ['promptoon', 'published', publishId] as const,
  episodeAnalytics: (episodeId: string) => ['promptoon', 'episodes', episodeId, 'analytics'] as const
};
