import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import { feedQuerySchema } from '../promptoon-authoring/promptoon.schemas';
import * as service from './feed.service';

const uuidSchema = z.string().uuid();

function getParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return Array.isArray(value) ? value[0] : value;
}

function parsePublishIds(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const publishIds = rawValues
    .flatMap((rawValue) => String(rawValue).split(','))
    .map((publishId) => publishId.trim())
    .filter(Boolean);

  return z.array(uuidSchema).max(100).parse(publishIds);
}

export function createFeedRouter(): Router {
  const router = Router();

  async function getFeed(request: Request, response: Response) {
    const query = feedQuerySchema.parse(request.query);
    response.json(await service.getEpisodeFeed(query));
  }

  router.get('/mixed', asyncHandler(getFeed));
  router.get('/episodes', asyncHandler(getFeed));
  router.get('/shorts', asyncHandler(getFeed));

  router.get('/state', requireAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.getContentInteractionStates(parsePublishIds(request.query.publishIds), getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/publishes/:publishId/like', requireAuth, asyncHandler(async (request, response) => {
    await service.likePublish(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.delete('/publishes/:publishId/like', requireAuth, asyncHandler(async (request, response) => {
    await service.unlikePublish(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.post('/publishes/:publishId/bookmark', requireAuth, asyncHandler(async (request, response) => {
    await service.bookmarkPublish(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.delete('/publishes/:publishId/bookmark', requireAuth, asyncHandler(async (request, response) => {
    await service.unbookmarkPublish(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.post('/events/impression', asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: 'feed_impression',
      ...request.body
    });
    response.status(202).json({ accepted: true });
  }));

  router.post('/events/open', asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: 'feed_open',
      ...request.body
    });
    response.status(202).json({ accepted: true });
  }));

  router.post('/events/watch-progress', asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: 'feed_video_progress',
      ...request.body
    });
    response.status(202).json({ accepted: true });
  }));

  return router;
}
