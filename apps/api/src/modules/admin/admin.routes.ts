import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import * as experimentalService from '../experimental/experimental.service';
import * as service from './admin.service';

const userListQuerySchema = z.object({
  query: z.string().trim().optional(),
  role: z.enum(['all', 'platform_admin', 'studio_member', 'no_studio']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const patchPlatformRoleSchema = z.object({
  role: z.literal('platform_admin').nullable()
});

const patchStudioRoleSchema = z.object({
  role: z.enum(['studio_admin', 'producer', 'writer', 'viewer']).nullable()
});
const createExperimentalTargetSchema = z.object({
  targetType: z.enum(['all', 'project', 'publish']),
  projectId: z.string().uuid().optional(),
  publishId: z.string().uuid().optional()
});
const patchExperimentalTargetSchema = z.object({
  status: z.enum(['active', 'disabled'])
});
const createExperimentalGrantSchema = z.object({
  loginId: z.string().trim().min(1).max(128)
});
const patchExperimentalGrantSchema = z.object({
  status: z.enum(['active', 'revoked'])
});
const createExperimentalInviteCodeSchema = z.object({
  mode: z.enum(['single_use_batch', 'multi_use']),
  count: z.number().int().min(1).max(500).optional(),
  maxRedemptions: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional()
});
const patchExperimentalInviteCodeSchema = z.object({
  status: z.literal('revoked')
});
const experimentalInviteCodeListQuerySchema = z.object({
  historyLimit: z.coerce.number().int().min(1).max(100).default(10),
  historyOffset: z.coerce.number().int().min(0).default(0)
});

function getParam(value: string | string[] | undefined, name: string): string {
  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return Array.isArray(value) ? value[0] : value;
}

export function createAdminRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(asyncHandler(async (request, _response, next) => {
    const user = getRequiredAuthUser(request);
    await service.ensurePlatformAdmin(user.sub, user.loginId);
    next();
  }));

  router.get('/me', asyncHandler(async (request, response) => {
    const user = getRequiredAuthUser(request);
    response.json(await service.me(user.sub, user.sid));
  }));

  router.get('/users', asyncHandler(async (request, response) => {
    const query = userListQuerySchema.parse(request.query);
    response.json(await service.listUsers(query));
  }));

  router.patch('/users/:userId/platform-role', asyncHandler(async (request, response) => {
    const body = patchPlatformRoleSchema.parse(request.body);
    const actor = getRequiredAuthUser(request);
    response.json(await service.updatePlatformRole(getParam(request.params.userId, 'userId'), body, actor.sub));
  }));

  router.patch('/users/:userId/studio-role', asyncHandler(async (request, response) => {
    const body = patchStudioRoleSchema.parse(request.body);
    response.json(await service.updateStudioRole(getParam(request.params.userId, 'userId'), body));
  }));

  router.get('/projects', asyncHandler(async (_request, response) => {
    response.json(await service.listProjects());
  }));

  router.get('/publishes', asyncHandler(async (_request, response) => {
    response.json(await service.listPublishes());
  }));

  router.get('/community/discourse', asyncHandler(async (_request, response) => {
    response.json(await service.getDiscourseSummary());
  }));

  router.get('/telemetry/summary', asyncHandler(async (_request, response) => {
    response.json(await service.getTelemetrySummary());
  }));

  router.get('/experimental/targets', asyncHandler(async (_request, response) => {
    response.json(await experimentalService.listTargets());
  }));

  router.post('/experimental/targets', asyncHandler(async (request, response) => {
    const body = createExperimentalTargetSchema.parse(request.body);
    const actor = getRequiredAuthUser(request);
    response.status(201).json(await experimentalService.createTarget(body, actor.sub));
  }));

  router.patch('/experimental/targets/:targetId', asyncHandler(async (request, response) => {
    const body = patchExperimentalTargetSchema.parse(request.body);
    response.json(await experimentalService.updateTargetStatus(getParam(request.params.targetId, 'targetId'), body.status));
  }));

  router.delete('/experimental/targets/:targetId', asyncHandler(async (request, response) => {
    await experimentalService.deleteTarget(getParam(request.params.targetId, 'targetId'));
    response.status(204).send();
  }));

  router.get('/experimental/targets/:targetId/grants', asyncHandler(async (request, response) => {
    response.json(await experimentalService.listTargetGrants(getParam(request.params.targetId, 'targetId')));
  }));

  router.post('/experimental/targets/:targetId/grants', asyncHandler(async (request, response) => {
    const body = createExperimentalGrantSchema.parse(request.body);
    const actor = getRequiredAuthUser(request);
    response.status(201).json(
      await experimentalService.grantTargetAccess(getParam(request.params.targetId, 'targetId'), body.loginId, actor.sub)
    );
  }));

  router.patch('/experimental/grants/:grantId', asyncHandler(async (request, response) => {
    const body = patchExperimentalGrantSchema.parse(request.body);
    response.json(await experimentalService.updateGrantStatus(getParam(request.params.grantId, 'grantId'), body.status));
  }));

  router.get('/experimental/targets/:targetId/invite-codes', asyncHandler(async (request, response) => {
    const query = experimentalInviteCodeListQuerySchema.parse(request.query);
    response.json(await experimentalService.listTargetInviteCodes(getParam(request.params.targetId, 'targetId'), query));
  }));

  router.post('/experimental/targets/:targetId/invite-codes', asyncHandler(async (request, response) => {
    const body = createExperimentalInviteCodeSchema.parse(request.body);
    const actor = getRequiredAuthUser(request);
    response.status(201).json(
      await experimentalService.createInviteCodes(getParam(request.params.targetId, 'targetId'), body, actor.sub)
    );
  }));

  router.patch('/experimental/invite-codes/:codeId', asyncHandler(async (request, response) => {
    patchExperimentalInviteCodeSchema.parse(request.body);
    response.json(await experimentalService.revokeInviteCode(getParam(request.params.codeId, 'codeId')));
  }));

  return router;
}
