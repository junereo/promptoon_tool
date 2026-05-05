import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import {
  analyticsQuerySchema,
  createChoiceSchema,
  createCutSchema,
  createEpisodeSchema,
  createLoopStateSettingSchema,
  createProjectSchema,
  deleteCutSchema,
  patchChoiceSchema,
  patchCutSchema,
  patchEpisodeCutLayoutSchema,
  patchEpisodeSchema,
  patchProjectSchema,
  patchProjectMemberSchema,
  publishSchema,
  reorderEpisodeCutsSchema,
  resetEpisodeAnalyticsSchema,
  upsertProjectMemberSchema
} from '../promptoon-authoring/promptoon.schemas';
import * as service from './studio.service';

const patchProjectAssetSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).default({})
});

function getParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return Array.isArray(value) ? value[0] : value;
}

function getBackupFileName(): string {
  return `promptoon-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
}

export function createStudioRouter(): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  });

  router.use(requireAuth);

  router.post('/projections/rebuild', asyncHandler(async (request, response) => {
    response.json(await service.rebuildPublicProjections(getRequiredAuthUser(request).sub));
  }));

  router.get('/backup/export', asyncHandler(async (request, response) => {
    response.setHeader('Content-Disposition', `attachment; filename="${getBackupFileName()}"`);
    response.json(await service.exportUserBackup(getRequiredAuthUser(request).sub));
  }));

  router.get('/projects', asyncHandler(async (request, response) => {
    response.json(await service.listProjects(getRequiredAuthUser(request).sub));
  }));

  router.post('/projects', asyncHandler(async (request, response) => {
    const body = createProjectSchema.parse(request.body);
    response.status(201).json(await service.createProject(body, getRequiredAuthUser(request).sub));
  }));

  router.patch('/projects/:projectId', asyncHandler(async (request, response) => {
    const body = patchProjectSchema.parse(request.body);
    response.json(await service.updateProject(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub));
  }));

  router.get('/projects/:projectId/assets', asyncHandler(async (request, response) => {
    response.json(await service.listProjectAssets(getParam(request.params.projectId, 'projectId'), getRequiredAuthUser(request).sub));
  }));

  router.get('/projects/:projectId/publishes', asyncHandler(async (request, response) => {
    response.json(await service.listProjectPublishHistory(getParam(request.params.projectId, 'projectId'), getRequiredAuthUser(request).sub));
  }));

  router.get('/projects/:projectId/publishes/:publishId/diff', asyncHandler(async (request, response) => {
    const toPublishId = typeof request.query.to === 'string' ? request.query.to : undefined;
    response.json(
      await service.diffProjectPublish(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.publishId, 'publishId'),
        toPublishId,
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.get('/projects/:projectId/publishes/:fromPublishId/compare/:toPublishId', asyncHandler(async (request, response) => {
    response.json(
      await service.compareProjectPublishes(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.fromPublishId, 'fromPublishId'),
        getParam(request.params.toPublishId, 'toPublishId'),
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.post('/projects/:projectId/publishes/:publishId/rollback', asyncHandler(async (request, response) => {
    response.status(201).json(
      await service.rollbackProjectPublish(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.publishId, 'publishId'),
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.get('/projects/:projectId/members', asyncHandler(async (request, response) => {
    response.json(await service.listProjectMembers(getParam(request.params.projectId, 'projectId'), getRequiredAuthUser(request).sub));
  }));

  router.post('/projects/:projectId/members', asyncHandler(async (request, response) => {
    const body = upsertProjectMemberSchema.parse(request.body);
    response.status(201).json(
      await service.addProjectMember(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/projects/:projectId/members/:userId', asyncHandler(async (request, response) => {
    const body = patchProjectMemberSchema.parse(request.body);
    response.json(
      await service.updateProjectMember(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.userId, 'userId'),
        body,
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.delete('/projects/:projectId/members/:userId', asyncHandler(async (request, response) => {
    response.json(
      await service.deleteProjectMember(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.userId, 'userId'),
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.post('/projects/:projectId/assets', upload.single('file'), asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'Image file is required.');
    }

    response.status(201).json(
      await service.uploadAsset(getParam(request.params.projectId, 'projectId'), request.file, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/projects/:projectId/assets/:assetId', asyncHandler(async (request, response) => {
    const body = patchProjectAssetSchema.parse(request.body);
    response.json(
      await service.updateAssetMetadata(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.assetId, 'assetId'),
        body.metadata,
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.delete('/projects/:projectId/assets/:assetId', asyncHandler(async (request, response) => {
    await service.deleteAsset(
      getParam(request.params.projectId, 'projectId'),
      getParam(request.params.assetId, 'assetId'),
      getRequiredAuthUser(request).sub
    );
    response.status(204).send();
  }));

  router.post('/projects/:projectId/assets/:assetId/replace', upload.single('file'), asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'Image file is required.');
    }

    response.json(
      await service.replaceAsset(
        getParam(request.params.projectId, 'projectId'),
        getParam(request.params.assetId, 'assetId'),
        request.file,
        getRequiredAuthUser(request).sub
      )
    );
  }));

  router.post('/projects/:projectId/episodes', asyncHandler(async (request, response) => {
    const body = createEpisodeSchema.parse(request.body);
    response.status(201).json(
      await service.createEpisode(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.get('/episodes/:episodeId/draft', asyncHandler(async (request, response) => {
    response.json(await service.getEpisodeDraft(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub));
  }));

  router.patch('/episodes/:episodeId', asyncHandler(async (request, response) => {
    const body = patchEpisodeSchema.parse(request.body);
    response.json(await service.updateEpisode(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub));
  }));

  router.get('/episodes/:episodeId/published/latest', asyncHandler(async (request, response) => {
    response.json(
      await service.getLatestPublishedEpisode(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/episodes/:episodeId/cuts', asyncHandler(async (request, response) => {
    const body = createCutSchema.parse(request.body);
    response.status(201).json(
      await service.createCut(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/episodes/:episodeId/cuts/reorder', asyncHandler(async (request, response) => {
    const body = reorderEpisodeCutsSchema.parse(request.body);
    response.json(
      await service.reorderEpisodeCuts(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/episodes/:episodeId/cuts/layout', asyncHandler(async (request, response) => {
    const body = patchEpisodeCutLayoutSchema.parse(request.body);
    response.json(
      await service.updateEpisodeCutLayout(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/episodes/:episodeId/loop-state-setting', asyncHandler(async (request, response) => {
    const body = createLoopStateSettingSchema.parse(request.body);
    response.status(201).json(
      await service.createLoopStateSetting(getParam(request.params.episodeId, 'episodeId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/cuts/:cutId', asyncHandler(async (request, response) => {
    const body = patchCutSchema.parse(request.body);
    response.json(await service.updateCut(getParam(request.params.cutId, 'cutId'), body, getRequiredAuthUser(request).sub));
  }));

  router.delete('/cuts/:cutId', asyncHandler(async (request, response) => {
    const body = deleteCutSchema.parse(request.body ?? {});
    await service.deleteCut(getParam(request.params.cutId, 'cutId'), getRequiredAuthUser(request).sub, body);
    response.status(204).send();
  }));

  router.post('/cuts/:cutId/choices', asyncHandler(async (request, response) => {
    const body = createChoiceSchema.parse(request.body);
    response.status(201).json(
      await service.createChoice(getParam(request.params.cutId, 'cutId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/choices/:choiceId', asyncHandler(async (request, response) => {
    const body = patchChoiceSchema.parse(request.body);
    response.json(await service.updateChoice(getParam(request.params.choiceId, 'choiceId'), body, getRequiredAuthUser(request).sub));
  }));

  router.delete('/choices/:choiceId', asyncHandler(async (request, response) => {
    await service.deleteChoice(getParam(request.params.choiceId, 'choiceId'), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.post('/episodes/:episodeId/validate', asyncHandler(async (request, response) => {
    response.json(await service.validateEpisode(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub));
  }));

  router.post('/projects/:projectId/publish', asyncHandler(async (request, response) => {
    const body = publishSchema.parse(request.body);
    response.status(201).json(
      await service.publishProject(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/projects/:projectId/publish/update', asyncHandler(async (request, response) => {
    const body = publishSchema.parse(request.body);
    response.json(await service.updatePublishedProject(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub));
  }));

  router.post('/projects/:projectId/unpublish', asyncHandler(async (request, response) => {
    const body = publishSchema.parse(request.body);
    await service.unpublishProject(getParam(request.params.projectId, 'projectId'), body, getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.get('/analytics/projects/:projectId', asyncHandler(async (request, response) => {
    response.json(await service.getProjectAnalytics(getParam(request.params.projectId, 'projectId'), getRequiredAuthUser(request).sub));
  }));

  router.get('/analytics/episodes/:episodeId', asyncHandler(async (request, response) => {
    const query = analyticsQuerySchema.parse(request.query);
    response.json(
      await service.getEpisodeAnalytics(
        getParam(request.params.episodeId, 'episodeId'),
        getRequiredAuthUser(request).sub,
        query.viewsGranularity,
        {
          from: query.viewsFrom,
          to: query.viewsTo
        }
      )
    );
  }));

  router.post('/analytics/episodes/:episodeId/reset', asyncHandler(async (request, response) => {
    const body = resetEpisodeAnalyticsSchema.parse(request.body);
    await service.resetEpisodeAnalytics(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub, body);
    response.status(204).send();
  }));

  return router;
}
