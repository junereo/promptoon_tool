import type { Request } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import {
  createChoiceSchema,
  createCutSchema,
  deleteCutSchema,
  createEpisodeSchema,
  createProjectSchema,
  feedQuerySchema,
  patchChoiceSchema,
  patchEpisodeSchema,
  patchCutSchema,
  reorderEpisodeCutsSchema,
  publishSchema,
  telemetryEventSchema
} from './promptoon.schemas';
import * as service from './promptoon.service';

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

export function createPromptoonRouter(): Router {
  const router = Router();
  const protectedRouter = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  });

  router.post('/telemetry/events', asyncHandler(async (request, response) => {
    const body = telemetryEventSchema.parse(request.body);
    await service.trackViewerEvent(body);
    response.status(202).json({ accepted: true });
  }));

  router.get('/episodes/feed', asyncHandler(async (request, response) => {
    const query = feedQuerySchema.parse(request.query);
    response.json(await service.getEpisodeFeed(query));
  }));

  router.get('/episodes/published/:publishId', asyncHandler(async (request, response) => {
    response.json(await service.getPublishedEpisode(getParam(request.params.publishId, 'publishId')));
  }));

  router.get('/share/:publishId', asyncHandler(async (request, response) => {
    const publishId = getParam(request.params.publishId, 'publishId');
    const endingCutId = typeof request.query.e === 'string' ? request.query.e : undefined;
    const html = await service.renderSharePage(publishId, endingCutId, getBaseOrigin(request));

    response.type('html').send(html);
  }));

  protectedRouter.use(requireAuth);

  protectedRouter.get('/projects', asyncHandler(async (request, response) => {
    response.json(await service.listProjects(getRequiredAuthUser(request).sub));
  }));

  protectedRouter.post('/projects/:projectId/assets', upload.single('file'), asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'Image file is required.');
    }

    response.status(201).json(
      await service.uploadAsset(getParam(request.params.projectId, 'projectId'), request.file, getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.get('/analytics/episodes/:episodeId', asyncHandler(async (request, response) => {
    response.json(await service.getEpisodeAnalytics(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub));
  }));

  protectedRouter.post('/projects', asyncHandler(async (request, response) => {
    const body = createProjectSchema.parse(request.body);
    const userId = getRequiredAuthUser(request).sub;
    response.status(201).json(await service.createProject(body, userId));
  }));

  protectedRouter.post('/projects/:projectId/episodes', asyncHandler(async (request, response) => {
    const body = createEpisodeSchema.parse(request.body);
    response.status(201).json(
      await service.createEpisode(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.get('/episodes/:episodeId/published/latest', asyncHandler(async (request, response) => {
    response.json(
      await service.getLatestPublishedEpisode(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.get('/episodes/:episodeId/draft', asyncHandler(async (request, response) => {
    response.json(await service.getEpisodeDraft(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub));
  }));

  protectedRouter.patch('/episodes/:episodeId', asyncHandler(async (request, response) => {
    const body = patchEpisodeSchema.parse(request.body);
    response.json(await service.updateEpisode(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub));
  }));

  protectedRouter.post('/episodes/:episodeId/cuts', asyncHandler(async (request, response) => {
    const body = createCutSchema.parse(request.body);
    response.status(201).json(
      await service.createCut(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.patch('/episodes/:episodeId/cuts/reorder', asyncHandler(async (request, response) => {
    const body = reorderEpisodeCutsSchema.parse(request.body);
    response.json(
      await service.reorderEpisodeCuts(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.patch('/cuts/:cutId', asyncHandler(async (request, response) => {
    const body = patchCutSchema.parse(request.body);
    response.json(await service.updateCut(getParam(request.params.cutId, 'cutId'), body, getRequiredAuthUser(request).sub));
  }));

  protectedRouter.delete('/cuts/:cutId', asyncHandler(async (request, response) => {
    const body = deleteCutSchema.parse(request.body ?? {});
    await service.deleteCut(getParam(request.params.cutId, 'cutId'), getRequiredAuthUser(request).sub, body);
    response.status(204).send();
  }));

  protectedRouter.post('/cuts/:cutId/choices', asyncHandler(async (request, response) => {
    const body = createChoiceSchema.parse(request.body);
    response.status(201).json(
      await service.createChoice(getParam(request.params.cutId, 'cutId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.patch('/choices/:choiceId', asyncHandler(async (request, response) => {
    const body = patchChoiceSchema.parse(request.body);
    response.json(
      await service.updateChoice(getParam(request.params.choiceId, 'choiceId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  protectedRouter.delete('/choices/:choiceId', asyncHandler(async (request, response) => {
    await service.deleteChoice(getParam(request.params.choiceId, 'choiceId'), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  protectedRouter.post('/episodes/:episodeId/validate', asyncHandler(async (request, response) => {
    response.json(await service.validateEpisode(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub));
  }));

  protectedRouter.post('/projects/:projectId/publish', asyncHandler(async (request, response) => {
    const body = publishSchema.parse(request.body);
    const userId = getRequiredAuthUser(request).sub;
    response.status(201).json(await service.publishProject(getParam(request.params.projectId, 'projectId'), body, userId));
  }));

  protectedRouter.post('/projects/:projectId/publish/update', asyncHandler(async (request, response) => {
    const body = publishSchema.parse(request.body);
    const userId = getRequiredAuthUser(request).sub;
    response.json(await service.updatePublishedProject(getParam(request.params.projectId, 'projectId'), body, userId));
  }));

  protectedRouter.post('/projects/:projectId/unpublish', asyncHandler(async (request, response) => {
    const body = publishSchema.parse(request.body);
    await service.unpublishProject(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.use(protectedRouter);

  return router;
}
