import { createRecommendationClient } from '@promptoon/recommendation-client';
import type { RecommendationContentType, RecommendationFeedResponse, RecommendationSurface } from '@promptoon/recommendation-contract';
import type {
  ContentInteractionStateListResponse,
  FeedHomeResponse,
  FeedItem,
  FeedRecommendationMeta,
  FeedResponse,
  TelemetryEventPayload
} from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { env } from '../../lib/env';
import { HttpError } from '../../lib/http-error';
import * as projectionService from '../promptoon-core/projection.service';
import * as repository from '../promptoon-core/product.repository';

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function normalizeInteractionPublishIds(publishIds: string[]): string[] {
  return Array.from(new Set(publishIds.map((publishId) => publishId.trim()).filter(Boolean))).slice(0, 100);
}

export interface FeedRecommendationAttribution {
  requestId?: string;
  policyId?: string;
  modelVersion?: string;
  experimentId?: string;
  trackingToken?: string;
  rank?: number;
  score?: number;
  source?: string;
  reason?: string;
  surface?: string;
}

const recommendationClient = createRecommendationClient({
  baseUrl: env.recommendation.apiUrl,
  timeoutMs: env.recommendation.timeoutMs
});
const recommendationFallbackLogKeys = new Set<string>();

function formatRecommendationFallbackError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logRecommendationFallback(surface: RecommendationSurface, error: unknown): void {
  const message = formatRecommendationFallbackError(error);
  const key = `${surface}:${message}`;

  if (recommendationFallbackLogKeys.has(key)) {
    return;
  }

  recommendationFallbackLogKeys.add(key);

  const log = env.nodeEnv === 'production' ? console.warn : console.info;
  log(
    `Recommendation API unavailable for ${surface}; using latest feed fallback. ` +
      `Start it with "pnpm run dev:recommendation" or check RECOMMENDATION_API_URL=${env.recommendation.apiUrl}. ` +
      `Cause: ${message}`
  );
}

function toRecommendationContentTypes(itemTypes?: string[]): RecommendationContentType[] | undefined {
  const supported = new Set<RecommendationContentType>(['promptoon', 'webtoon_episode', 'short_drama']);
  const contentTypes = (itemTypes ?? []).filter((itemType): itemType is RecommendationContentType =>
    supported.has(itemType as RecommendationContentType)
  );

  return contentTypes.length > 0 ? contentTypes : undefined;
}

function toFeedRecommendationMeta(
  response: RecommendationFeedResponse,
  item: RecommendationFeedResponse['items'][number],
  surface: RecommendationSurface
): FeedRecommendationMeta {
  return {
    requestId: response.requestId,
    policyId: response.policyId,
    modelVersion: response.modelVersion,
    experimentId: response.experimentId,
    trackingToken: item.trackingToken,
    rank: item.rank,
    score: item.score,
    source: item.source,
    reason: item.reason,
    surface
  };
}

async function hydrateRecommendedFeed(
  response: RecommendationFeedResponse,
  surface: RecommendationSurface,
  userId?: string
): Promise<FeedResponse | null> {
  if (response.items.length === 0) {
    return null;
  }

  const rows = await repository.listFeedItemProjectionsByPublishIds(db, response.items.map((item) => item.publishId), userId);
  const byPublishId = new Map(rows.map((row) => [row.publishId, row]));
  const items = response.items.flatMap<FeedItem>((recommendedItem) => {
    const row = byPublishId.get(recommendedItem.publishId);
    if (!row) {
      return [];
    }

    return [{
      ...row.item,
      recommendation: toFeedRecommendationMeta(response, recommendedItem, surface)
    }];
  });

  return items.length > 0
    ? {
        items,
        nextCursor: response.nextCursor
      }
    : null;
}

function toProjectionFallbackInput(input: { cursor?: string; itemTypes?: string[]; limit: number }) {
  if (!input.cursor) {
    return input;
  }

  try {
    projectionService.decodeFeedCursor(input.cursor);
    return input;
  } catch {
    return {
      ...input,
      cursor: undefined
    };
  }
}

async function getRecommendedFeed(input: {
  anonymousId?: string;
  cursor?: string;
  itemTypes?: string[];
  limit: number;
  surface: RecommendationSurface;
  userId?: string;
}): Promise<FeedResponse | null> {
  const response = await recommendationClient.recommendFeed({
    user: {
      userId: input.userId ?? null,
      anonymousId: input.anonymousId ?? null,
      isLoggedIn: Boolean(input.userId)
    },
    context: {
      surface: input.surface,
      device: 'mobile',
      locale: 'ko-KR',
      cursor: input.cursor ?? null,
      limit: input.limit
    },
    constraints: {
      contentTypes: toRecommendationContentTypes(input.itemTypes),
      excludePublishIds: [],
      safeMode: true
    }
  });

  return hydrateRecommendedFeed(response, input.surface, input.userId);
}

export async function getEpisodeFeed(input: {
  anonymousId?: string;
  cursor?: string;
  itemTypes?: string[];
  limit: number;
  userId?: string;
}): Promise<FeedResponse> {
  try {
    const recommended = await getRecommendedFeed({
      ...input,
      surface: 'discovery_feed'
    });
    if (recommended) {
      return recommended;
    }
  } catch (error) {
    logRecommendationFallback('discovery_feed', error);
  }

  return projectionService.getEpisodeFeed({
    ...toProjectionFallbackInput(input),
    userId: input.userId
  });
}

export async function getFeedHome(input: { anonymousId?: string; userId?: string } = {}): Promise<FeedHomeResponse> {
  const home = await projectionService.getFeedHome(input.userId);

  try {
    const recommended = await getRecommendedFeed({
      ...input,
      itemTypes: ['promptoon', 'webtoon_episode'],
      limit: 12,
      surface: 'home_feed'
    });
    if (!recommended) {
      return home;
    }

    return {
      ...home,
      sections: home.sections.map((section) =>
        section.key === 'recommended'
          ? {
              ...section,
              items: recommended.items
            }
          : section
      )
    };
  } catch (error) {
    logRecommendationFallback('home_feed', error);
    return home;
  }
}

export function searchFeed(input: { cursor?: string; itemTypes?: string[]; limit: number; query?: string; userId?: string }): Promise<FeedResponse> {
  return projectionService.searchFeed(input);
}

export function getBookmarkedFeed(input: { cursor?: string; limit: number; userId: string }): Promise<FeedResponse> {
  return projectionService.getBookmarkedFeed(input);
}

export async function getFeedItemByPublishId(publishId: string, userId?: string) {
  return assertExists(await repository.getFeedItemByPublicPublishId(db, publishId, userId), 'Published content not found.');
}

export async function getContentInteractionStates(
  publishIds: string[],
  userId: string
): Promise<ContentInteractionStateListResponse> {
  const normalizedPublishIds = normalizeInteractionPublishIds(publishIds);

  return {
    items: await repository.listContentInteractionStates(db, {
      publishIds: normalizedPublishIds,
      userId
    })
  };
}

export async function likePublish(publishId: string, userId: string, recommendation?: FeedRecommendationAttribution): Promise<void> {
  const context = await repository.getPublishProjectionContext(db, publishId);
  const movingtoonContext = context ? null : await repository.getMovingtoonPublishProjectionContext(db, publishId);
  const target = assertExists(context ?? movingtoonContext, 'Published content not found.');

  await withTransaction(async (client) => {
    const refreshedContext = context
      ? await repository.upsertUserLike(client, publishId, userId).then(() => repository.refreshFeedItemLikeMetrics(client, publishId))
      : await repository
          .upsertUserMovingtoonLike(client, publishId, userId)
          .then(() => repository.refreshMovingtoonFeedItemLikeMetrics(client, publishId));
    await projectionService.rebuildChannelProjectionForChannel(client, refreshedContext?.channel_id ?? target.channel_id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_like',
      userId,
      projectId: target.project_id,
      channelId: target.channel_id ?? undefined,
      seriesId: target.series_id ?? undefined,
      episodeId: target.episode_id,
      publishId,
      feedItemId: target.feed_item_id ?? undefined,
      payload: {
        action: 'like',
        recommendation
      }
    });
  });
}

export async function unlikePublish(publishId: string, userId: string, recommendation?: FeedRecommendationAttribution): Promise<void> {
  const context = await repository.getPublishProjectionContext(db, publishId);
  const movingtoonContext = context ? null : await repository.getMovingtoonPublishProjectionContext(db, publishId);
  const target = assertExists(context ?? movingtoonContext, 'Published content not found.');

  await withTransaction(async (client) => {
    const refreshedContext = context
      ? await repository.deleteUserLike(client, publishId, userId).then(() => repository.refreshFeedItemLikeMetrics(client, publishId))
      : await repository
          .deleteUserMovingtoonLike(client, publishId, userId)
          .then(() => repository.refreshMovingtoonFeedItemLikeMetrics(client, publishId));
    await projectionService.rebuildChannelProjectionForChannel(client, refreshedContext?.channel_id ?? target.channel_id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_like',
      userId,
      projectId: target.project_id,
      channelId: target.channel_id ?? undefined,
      seriesId: target.series_id ?? undefined,
      episodeId: target.episode_id,
      publishId,
      feedItemId: target.feed_item_id ?? undefined,
      payload: {
        action: 'unlike',
        recommendation
      }
    });
  });
}

export async function bookmarkPublish(publishId: string, userId: string, recommendation?: FeedRecommendationAttribution): Promise<void> {
  const context = await repository.getPublishProjectionContext(db, publishId);
  const movingtoonContext = context ? null : await repository.getMovingtoonPublishProjectionContext(db, publishId);
  const target = assertExists(context ?? movingtoonContext, 'Published content not found.');

  await withTransaction(async (client) => {
    if (context) {
      await repository.upsertUserBookmark(client, publishId, userId);
    } else {
      await repository.upsertUserMovingtoonBookmark(client, publishId, userId);
    }
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_bookmark',
      userId,
      projectId: target.project_id,
      channelId: target.channel_id ?? undefined,
      seriesId: target.series_id ?? undefined,
      episodeId: target.episode_id,
      publishId,
      feedItemId: target.feed_item_id ?? undefined,
      payload: {
        action: 'bookmark',
        recommendation
      }
    });
  });
}

export async function unbookmarkPublish(publishId: string, userId: string, recommendation?: FeedRecommendationAttribution): Promise<void> {
  const context = await repository.getPublishProjectionContext(db, publishId);
  const movingtoonContext = context ? null : await repository.getMovingtoonPublishProjectionContext(db, publishId);
  const target = assertExists(context ?? movingtoonContext, 'Published content not found.');

  await withTransaction(async (client) => {
    if (context) {
      await repository.deleteUserBookmark(client, publishId, userId);
    } else {
      await repository.deleteUserMovingtoonBookmark(client, publishId, userId);
    }
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_bookmark',
      userId,
      projectId: target.project_id,
      channelId: target.channel_id ?? undefined,
      seriesId: target.series_id ?? undefined,
      episodeId: target.episode_id,
      publishId,
      feedItemId: target.feed_item_id ?? undefined,
      payload: {
        action: 'unbookmark',
        recommendation
      }
    });
  });
}

export async function trackTelemetryEvent(payload: TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}
