export interface TelemetryEventPayload {
  eventName: string;
  anonymousId?: string;
  userId?: string;
  sessionId?: string;
  projectId?: string;
  channelId?: string;
  seriesId?: string;
  episodeId?: string;
  publishId?: string;
  feedItemId?: string;
  payload?: Record<string, unknown>;
}

export interface ProjectAnalyticsEpisodeSummary {
  episodeId: string;
  title: string;
  episodeNo: number;
  status: 'draft' | 'published';
  publishCount: number;
  totalViews: number;
  uniqueViewers: number;
  endingReaches: number;
  latestPublishedAt: string | null;
}

export interface ProjectAnalyticsResponse {
  projectId: string;
  title: string;
  status: 'draft' | 'published';
  totalEpisodes: number;
  publishedEpisodes: number;
  draftEpisodes: number;
  totalPublishes: number;
  totalViews: number;
  uniqueViewers: number;
  feedImpressions: number;
  endingReaches: number;
  completionRate: number;
  latestPublishedAt: string | null;
  episodes: ProjectAnalyticsEpisodeSummary[];
}

export type {
  AnalyticsEpisodeResponse,
  AnalyticsFeedEntry,
  AnalyticsResetScope,
  AnalyticsViewGranularity,
  AnalyticsViewRange,
  TelemetryEventRequest,
  TelemetryEventType
} from './legacy';
