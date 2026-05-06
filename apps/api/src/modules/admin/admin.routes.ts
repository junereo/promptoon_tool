import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
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

  return router;
}
