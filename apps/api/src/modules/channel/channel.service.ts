import type { ChannelHome, ChannelSubscriptionStateResponse } from '@promptoon/shared';

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

export function getChannelHome(channelSlug: string): Promise<ChannelHome> {
  return projectionService.getChannelHome(channelSlug);
}

export async function getChannelSubscriptionState(
  channelId: string,
  userId: string
): Promise<ChannelSubscriptionStateResponse> {
  return assertExists(
    await repository.getChannelSubscriptionState(db, {
      channelId,
      userId
    }),
    'Channel not found.'
  );
}

export async function subscribeToChannel(channelId: string, userId: string): Promise<void> {
  assertExists(await repository.getChannelSubscriptionState(db, { channelId, userId }), 'Channel not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserSubscription(client, channelId, userId);
    await projectionService.rebuildChannelProjectionForChannel(client, channelId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_subscribe',
      userId,
      channelId,
      payload: {
        action: 'subscribe'
      }
    });
  });
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  assertExists(await repository.getChannelSubscriptionState(db, { channelId, userId }), 'Channel not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserSubscription(client, channelId, userId);
    await projectionService.rebuildChannelProjectionForChannel(client, channelId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_subscribe',
      userId,
      channelId,
      payload: {
        action: 'unsubscribe'
      }
    });
  });
}
