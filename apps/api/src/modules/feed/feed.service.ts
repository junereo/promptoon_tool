import type { ContentInteractionStateListResponse, FeedHomeResponse, FeedResponse, TelemetryEventPayload } from '@promptoon/shared';

import { db, withTransaction } from '../../db';
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

export function getEpisodeFeed(input: { cursor?: string; itemTypes?: string[]; limit: number }): Promise<FeedResponse> {
  return projectionService.getEpisodeFeed(input);
}

export function getFeedHome(): Promise<FeedHomeResponse> {
  return projectionService.getFeedHome();
}

export function searchFeed(input: { cursor?: string; itemTypes?: string[]; limit: number; query?: string }): Promise<FeedResponse> {
  return projectionService.searchFeed(input);
}

export function getBookmarkedFeed(input: { cursor?: string; limit: number; userId: string }): Promise<FeedResponse> {
  return projectionService.getBookmarkedFeed(input);
}

export async function getFeedItemByPublishId(publishId: string) {
  return assertExists(await repository.getFeedItemByPublicPublishId(db, publishId), 'Published content not found.');
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

export async function likePublish(publishId: string, userId: string): Promise<void> {
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
        action: 'like'
      }
    });
  });
}

export async function unlikePublish(publishId: string, userId: string): Promise<void> {
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
        action: 'unlike'
      }
    });
  });
}

export async function bookmarkPublish(publishId: string, userId: string): Promise<void> {
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
        action: 'bookmark'
      }
    });
  });
}

export async function unbookmarkPublish(publishId: string, userId: string): Promise<void> {
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
        action: 'unbookmark'
      }
    });
  });
}

export async function trackTelemetryEvent(payload: TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}
