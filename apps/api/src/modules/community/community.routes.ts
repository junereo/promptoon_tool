import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import * as service from './community.service';

const commentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

const moderateCommentSchema = z.object({
  status: z.enum(['visible', 'hidden', 'deleted']),
  reason: z.string().trim().max(500).nullable().optional()
});

const discourseThreadSyncSchema = z.object({
  discourseTopicId: z.string().trim().min(1).nullable().optional(),
  status: z.enum(['pending', 'synced', 'failed']).default('pending'),
  payload: z.record(z.string(), z.unknown()).optional()
});

function getParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return Array.isArray(value) ? value[0] : value;
}

export function createCommunityRouter(): Router {
  const router = Router();

  router.post('/episodes/:episodeId/discussion', requireAuth, asyncHandler(async (request, response) => {
    await service.ensureDiscussionForEpisode(getParam(request.params.episodeId, 'episodeId'), getRequiredAuthUser(request).sub);
    response.status(201).json({ created: true });
  }));

  router.get('/publishes/:publishId/comments-meta', asyncHandler(async (request, response) => {
    response.json(await service.getCommentsMeta(getParam(request.params.publishId, 'publishId')));
  }));

  router.get('/publishes/:publishId/embed', asyncHandler(async (request, response) => {
    response.json(await service.getCommunityEmbed(getParam(request.params.publishId, 'publishId')));
  }));

  router.get('/publishes/:publishId/comments', asyncHandler(async (request, response) => {
    response.json(await service.listComments(getParam(request.params.publishId, 'publishId')));
  }));

  router.post('/publishes/:publishId/comments', requireAuth, asyncHandler(async (request, response) => {
    const body = commentBodySchema.parse(request.body);
    response.status(201).json(
      await service.createComment(getParam(request.params.publishId, 'publishId'), body.body, getRequiredAuthUser(request).sub)
    );
  }));

  router.patch('/comments/:commentId', requireAuth, asyncHandler(async (request, response) => {
    const body = commentBodySchema.parse(request.body);
    response.json(await service.updateComment(getParam(request.params.commentId, 'commentId'), body.body, getRequiredAuthUser(request).sub));
  }));

  router.delete('/comments/:commentId', requireAuth, asyncHandler(async (request, response) => {
    await service.deleteComment(getParam(request.params.commentId, 'commentId'), getRequiredAuthUser(request).sub);
    response.status(204).send();
  }));

  router.post('/comments/:commentId/moderation', requireAuth, asyncHandler(async (request, response) => {
    const body = moderateCommentSchema.parse(request.body);
    response.json(await service.moderateComment(getParam(request.params.commentId, 'commentId'), body, getRequiredAuthUser(request).sub));
  }));

  router.post('/publishes/:publishId/discourse-sync', requireAuth, asyncHandler(async (request, response) => {
    const body = discourseThreadSyncSchema.parse(request.body);
    response.json(await service.syncDiscourseThread(getParam(request.params.publishId, 'publishId'), body, getRequiredAuthUser(request).sub));
  }));

  router.post('/discourse/webhook', asyncHandler(async (request, response) => {
    await service.trackTelemetryEvent({
      eventName: 'community_discourse_webhook',
      payload: request.body ?? {}
    });
    response.status(202).json({ accepted: true });
  }));

  return router;
}
