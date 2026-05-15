import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler';
import * as service from './landing.service';

export function createLandingRouter(): Router {
  const router = Router();

  router.get('/', asyncHandler(async (_request, response) => {
    response.json(await service.getLanding());
  }));

  return router;
}
