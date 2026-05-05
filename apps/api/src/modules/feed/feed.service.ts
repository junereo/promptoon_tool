import type { ContentInteractionStateListResponse, FeedResponse, TelemetryEventPayload } from '@promptoon/shared';

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

export function getEpisodeFeed(input: { cursor?: string; limit: number }): Promise<FeedResponse> {
  return projectionService.getEpisodeFeed(input);
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
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserLike(client, publishId, userId);
    const refreshedContext = await repository.refreshFeedItemLikeMetrics(client, publishId);
    await projectionService.rebuildChannelProjectionForChannel(client, refreshedContext?.channel_id ?? context.channel_id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_like',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'like'
      }
    });
  });
}

export async function unlikePublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserLike(client, publishId, userId);
    const refreshedContext = await repository.refreshFeedItemLikeMetrics(client, publishId);
    await projectionService.rebuildChannelProjectionForChannel(client, refreshedContext?.channel_id ?? context.channel_id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_like',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'unlike'
      }
    });
  });
}

export async function bookmarkPublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserBookmark(client, publishId, userId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_bookmark',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'bookmark'
      }
    });
  });
}

export async function unbookmarkPublish(publishId: string, userId: string): Promise<void> {
  const context = assertExists(await repository.getPublishProjectionContext(db, publishId), 'Published episode not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserBookmark(client, publishId, userId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'feed_bookmark',
      userId,
      projectId: context.project_id,
      channelId: context.channel_id ?? undefined,
      seriesId: context.series_id ?? undefined,
      episodeId: context.episode_id,
      publishId,
      feedItemId: context.feed_item_id ?? undefined,
      payload: {
        action: 'unbookmark'
      }
    });
  });
}

export async function trackTelemetryEvent(payload: TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}
