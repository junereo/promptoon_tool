import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getOptionalAuthUser, getRequiredAuthUser, optionalAuth, requireAuth } from '../../lib/auth';
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
  createTopic: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

const discourseCommentSchema = z.object({
  scope: z.enum(['project', 'episode']).default('episode'),
  raw: z.string().trim().min(1).max(20000),
  topicId: z.string().trim().min(1).nullable().optional(),
  replyToPostNumber: z.number().int().positive().nullable().optional()
});

const discoursePostEditSchema = z.object({
  raw: z.string().trim().min(1).max(20000)
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

  router.get('/publishes/:publishId/comments-meta', optionalAuth, asyncHandler(async (request, response) => {
    response.json(await service.getCommentsMeta(getParam(request.params.publishId, 'publishId'), getOptionalAuthUser(request)?.sub));
  }));

  router.get('/publishes/:publishId/embed', optionalAuth, asyncHandler(async (request, response) => {
    response.json(await service.getCommunityEmbed(getParam(request.params.publishId, 'publishId'), getOptionalAuthUser(request)?.sub));
  }));

  router.get('/publishes/:publishId/comments', optionalAuth, asyncHandler(async (request, response) => {
    response.json(await service.listComments(getParam(request.params.publishId, 'publishId'), getOptionalAuthUser(request)?.sub));
  }));

  router.post('/publishes/:publishId/comments', requireAuth, asyncHandler(async (request, response) => {
    const body = commentBodySchema.parse(request.body);
    response.status(201).json(
      await service.createComment(getParam(request.params.publishId, 'publishId'), body.body, getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/publishes/:publishId/anonymous-comments', asyncHandler(async (request, response) => {
    const body = commentBodySchema.parse(request.body);
    response.status(201).json(await service.createAnonymousComment(getParam(request.params.publishId, 'publishId'), body.body));
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

  router.post('/publishes/:publishId/discourse-topic', requireAuth, asyncHandler(async (request, response) => {
    response.status(201).json(
      await service.createDiscourseThreadForPublish(getParam(request.params.publishId, 'publishId'), getRequiredAuthUser(request).sub)
    );
  }));

  router.get('/publishes/:publishId/discourse/comments', optionalAuth, asyncHandler(async (request, response) => {
    const scope = request.query.scope === 'episode' ? 'episode' : 'project';
    response.json(
      await service.listDiscourseComments(getParam(request.params.publishId, 'publishId'), scope, getOptionalAuthUser(request)?.sub)
    );
  }));

  router.get('/publishes/:publishId/discourse/interaction', optionalAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.getDiscourseInteraction(
        getParam(request.params.publishId, 'publishId'),
        getOptionalAuthUser(request)?.sub ?? null
      )
    );
  }));

  router.post('/publishes/:publishId/discourse/like', requireAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.likeDiscoursePublish(getParam(request.params.publishId, 'publishId'), getRequiredAuthUser(request).sub)
    );
  }));

  router.delete('/publishes/:publishId/discourse/like', requireAuth, asyncHandler(async (request, response) => {
    response.json(
      await service.unlikeDiscoursePublish(getParam(request.params.publishId, 'publishId'), getRequiredAuthUser(request).sub)
    );
  }));

  router.post('/publishes/:publishId/discourse/comments', requireAuth, asyncHandler(async (request, response) => {
    const body = discourseCommentSchema.parse(request.body);
    response.status(201).json(
      await service.createDiscourseComment(getParam(request.params.publishId, 'publishId'), body, getRequiredAuthUser(request).sub)
    );
  }));

  router.get('/discourse/assets', asyncHandler(async (request, response) => {
    if (typeof request.query.path !== 'string') {
      throw new HttpError(400, 'Missing Discourse asset path.');
    }

    const asset = await service.getDiscourseAsset(request.query.path);
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('Cache-Control', asset.cacheControl ?? 'public, max-age=86400');
    response.send(asset.body);
  }));

  router.get('/discourse/categories', asyncHandler(async (_request, response) => {
    response.json(await service.getDiscourseCategories());
  }));

  router.get('/discourse/latest', asyncHandler(async (_request, response) => {
    response.json(await service.getDiscourseLatestTopics());
  }));

  router.get('/discourse/top', asyncHandler(async (_request, response) => {
    response.json(await service.getDiscourseTopTopics());
  }));

  router.get('/discourse/t/:topicId', asyncHandler(async (request, response) => {
    response.json(await service.getDiscourseTopic(getParam(request.params.topicId, 'topicId')));
  }));

  router.patch('/discourse/posts/:postId', requireAuth, asyncHandler(async (request, response) => {
    const body = discoursePostEditSchema.parse(request.body);
    response.json(await service.updateDiscoursePost(getParam(request.params.postId, 'postId'), body.raw, getRequiredAuthUser(request).sub));
  }));

  router.delete('/discourse/posts/:postId', requireAuth, asyncHandler(async (request, response) => {
    response.json(await service.deleteDiscoursePost(getParam(request.params.postId, 'postId'), getRequiredAuthUser(request).sub));
  }));

  router.post('/discourse/posts/:postId/like', requireAuth, asyncHandler(async (request, response) => {
    response.json(await service.likeDiscoursePost(getParam(request.params.postId, 'postId'), getRequiredAuthUser(request).sub));
  }));

  router.post('/discourse/posts/:postId/bookmark', requireAuth, asyncHandler(async (request, response) => {
    response.json(await service.bookmarkDiscoursePost(getParam(request.params.postId, 'postId'), getRequiredAuthUser(request).sub));
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
