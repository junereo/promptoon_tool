import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import * as service from './platform-access.service';

const redeemPlatformAccessCodeSchema = z.object({
  code: z.string().trim().min(1).max(64)
});

export function createPlatformAccessRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/me', asyncHandler(async (request, response) => {
    response.json(await service.getMyAccess(getRequiredAuthUser(request).sub));
  }));

  router.post('/redeem', asyncHandler(async (request, response) => {
    const body = redeemPlatformAccessCodeSchema.parse(request.body);
    response.json(await service.redeemCode(body.code, getRequiredAuthUser(request).sub));
  }));

  return router;
}
