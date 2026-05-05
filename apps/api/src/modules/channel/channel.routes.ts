import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import * as service from './channel.service';

const uuidSchema = z.string().uuid();

function getParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return Array.isArray(value) ? value[0] : value;
}

export function createChannelRouter(): Router {
  const router = Router();

  router.get('/:channelSlug', asyncHandler(async (request, response) => {
    response.json(await service.getChannelHome(getParam(request.params.channelSlug, 'channelSlug')));
  }));

  router.get('/:channelSlug/home', asyncHandler(async (request, response) => {
    response.json(await service.getChannelHome(getParam(request.params.channelSlug, 'channelSlug')));
  }));

  router.get('/:channelSlug/series', asyncHandler(async (request, response) => {
    const home = await service.getChannelHome(getParam(request.params.channelSlug, 'channelSlug'));
    response.json(home.featuredSeries);
  }));

  router.get('/:channelSlug/episodes', asyncHandler(async (request, response) => {
    const home = await service.getChannelHome(getParam(request.params.channelSlug, 'channelSlug'));
    response.json(home.latestEpisodes);
  }));

  router.get('/:channelSlug/shorts', asyncHandler(async (request, response) => {
    const home = await service.getChannelHome(getParam(request.params.channelSlug, 'channelSlug'));
    response.json(home.latestShorts);
  }));

  router.get('/:channelSlug/community-meta', asyncHandler(async (request, response) => {
    const home = await service.getChannelHome(getParam(request.params.channelSlug, 'channelSlug'));
    response.json(home.communityMeta ?? { commentCount: 0 });
  }));

  router.get('/:channelId/subscription', requireAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.getChannelSubscriptionState(
        uuidSchema.parse(getParam(request.params.channelId, 'channelId')),
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.post('/:channelId/subscribe', requireAuth, asyncHandler(async (request, response) => {
    await service.subscribeToChannel(uuidSchema.parse(getParam(request.params.channelId, 'channelId')), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.delete('/:channelId/subscribe', requireAuth, asyncHandler(async (request, response) => {
    await service.unsubscribeFromChannel(uuidSchema.parse(getParam(request.params.channelId, 'channelId')), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  return router;
}
