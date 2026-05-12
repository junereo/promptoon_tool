import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getOptionalAuthUser, getRequiredAuthUser, optionalAuth, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import * as service from './viewer.service';

const uuidSchema = z.string().uuid();

function getParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return Array.isArray(value) ? value[0] : value;
}

function getBaseOrigin(request: Request): string {
  const configuredOrigin = process.env.APP_ORIGIN?.trim();
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, '');
  }

  const host = request.get('host');
  if (!host) {
    throw new HttpError(500, 'Unable to determine request origin.');
  }

  return `${request.protocol}://${host}`;
}

export function createViewerRouter(): Router {
  const router = Router();

  router.get('/publishes/:publishId', optionalAuth, asyncHandler(async (request, response) => {
    const user = getOptionalAuthUser(request);
    response.json(await service.getPublishedEpisode(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), user?.sub));
  }));

  router.get('/publishes/:publishId/episodes/:episodeNo', optionalAuth, asyncHandler(async (request, response) => {
    const user = getOptionalAuthUser(request);
    response.json(await service.getPublishedEpisode(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), user?.sub));
  }));

  router.get('/publishes/:publishId/related-shorts', optionalAuth, asyncHandler(async (request, response) => {
    const user = getOptionalAuthUser(request);
    response.json(await service.getRelatedShorts(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), user?.sub));
  }));

  router.get('/publishes/:publishId/share', asyncHandler(async (request, response) => {
    const publishId = uuidSchema.parse(getParam(request.params.publishId, 'publishId'));
    const endingCutId = typeof request.query.e === 'string' ? request.query.e : undefined;
    const html = await service.renderSharePage(publishId, endingCutId, getBaseOrigin(request), {
      sharePath: `/api/viewer/publishes/${publishId}/share`
    });

    response.type('html').send(html);
  }));

  router.get('/publishes/:publishId/state', requireAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.getViewerInteractionState(uuidSchema.parse(getParam(request.params.publishId, 'publishId')), getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/events', asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: request.body?.eventName ?? 'viewer_event',
      ...request.body
    });
    response.status(202).json({ accepted: true });
  }));

  router.post('/publishes/:publishId/continue', requireAuth, asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: 'viewer_continue',
      publishId: uuidSchema.parse(getParam(request.params.publishId, 'publishId')),
      payload: request.body ?? {}
    });
    response.status(202).json({ accepted: true });
  }));

  return router;
}
