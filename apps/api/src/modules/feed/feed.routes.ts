import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getOptionalAuthUser, getRequiredAuthUser, optionalAuth, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import { feedQuerySchema } from '../promptoon-authoring/promptoon.schemas';
import * as service from './feed.service';

const uuidSchema = z.string().uuid();
const feedSearchTypeSchema = z.enum(['all', 'promptoon', 'webtoon_episode', 'short_drama']).default('all');
const feedSearchQuerySchema = feedQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  type: feedSearchTypeSchema
});
const anonymousIdHeaderSchema = z.string().uuid();
const recommendationAttributionSchema = z.object({
  requestId: uuidSchema.optional(),
  policyId: z.string().trim().max(128).optional(),
  modelVersion: z.string().trim().max(128).optional(),
  experimentId: z.string().trim().max(128).optional(),
  trackingToken: z.string().trim().max(2048).optional(),
  rank: z.number().int().min(1).max(1000).optional(),
  score: z.number().optional(),
  source: z.string().trim().max(128).optional(),
  reason: z.string().trim().max(128).optional(),
  surface: z.string().trim().max(64).optional()
});
const feedInteractionBodySchema = z.object({
  recommendation: recommendationAttributionSchema.optional()
}).default({});

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

function getAnonymousId(request: Request): string | undefined {
  const rawValue = request.header('x-promptoon-anonymous-id');
  const parsed = anonymousIdHeaderSchema.safeParse(rawValue);
  return parsed.success ? parsed.data : undefined;
}

function getRecommendationAttribution(request: Request) {
  return feedInteractionBodySchema.parse(request.body ?? {}).recommendation;
}

export function createFeedRouter(): Router {
  const router = Router();

  async function getFeed(request: Request, response: Response, itemTypes?: string[]) {
    const query = feedQuerySchema.parse(request.query);
    const user = getOptionalAuthUser(request);
    response.json(await service.getEpisodeFeed({
      ...query,
      anonymousId: getAnonymousId(request),
      itemTypes,
      userId: user?.sub
    }));
  }

  router.get('/home', optionalAuth, asyncHandler(async (request, response) => {
    const user = getOptionalAuthUser(request);
    response.json(await service.getFeedHome({
      anonymousId: getAnonymousId(request),
      userId: user?.sub
    }));
  }));
  router.get('/search', asyncHandler(async (request, response) => {
    const query = feedSearchQuerySchema.parse(request.query);
    response.json(
      await service.searchFeed({
        cursor: query.cursor,
        itemTypes: query.type === 'all' ? undefined : [query.type],
        limit: query.limit,
        query: query.q
      })
    );
  }));
  router.get('/bookmarks', requireAuth, asyncHandler(async (request, response) => {
    const query = feedQuerySchema.parse(request.query);
    response.json(
      await service.getBookmarkedFeed({
        ...query,
        userId: getRequiredAuthUser(request).sub
      })
    );
  }));
  router.get('/mixed', optionalAuth, asyncHandler(async (request, response) => getFeed(request, response)));
  router.get('/episodes', optionalAuth, asyncHandler(async (request, response) => getFeed(request, response, ['promptoon', 'webtoon_episode'])));
  router.get('/shorts', optionalAuth, asyncHandler(async (request, response) => getFeed(request, response, ['short_drama'])));
  router.get('/shorts/:publishId', asyncHandler(async (request, response) => {
    response.json(await service.getFeedItemByPublishId(uuidSchema.parse(getParam(request.params.publishId, 'publishId'))));
  }));

  router.get('/state', requireAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.getContentInteractionStates(parsePublishIds(request.query.publishIds), getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/publishes/:publishId/like', requireAuth, asyncHandler(async (request, response) => {
    await service.likePublish(
      uuidSchema.parse(getParam(request.params.publishId, 'publishId')),
      getRequiredAuthUser(request).sub,
      getRecommendationAttribution(request)
    );
    response.status(204).send();
  }));

  router.delete('/publishes/:publishId/like', requireAuth, asyncHandler(async (request, response) => {
    await service.unlikePublish(
      uuidSchema.parse(getParam(request.params.publishId, 'publishId')),
      getRequiredAuthUser(request).sub,
      getRecommendationAttribution(request)
    );
    response.status(204).send();
  }));

  router.post('/publishes/:publishId/bookmark', requireAuth, asyncHandler(async (request, response) => {
    await service.bookmarkPublish(
      uuidSchema.parse(getParam(request.params.publishId, 'publishId')),
      getRequiredAuthUser(request).sub,
      getRecommendationAttribution(request)
    );
    response.status(204).send();
  }));

  router.delete('/publishes/:publishId/bookmark', requireAuth, asyncHandler(async (request, response) => {
    await service.unbookmarkPublish(
      uuidSchema.parse(getParam(request.params.publishId, 'publishId')),
      getRequiredAuthUser(request).sub,
      getRecommendationAttribution(request)
    );
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
