import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler';
import { loginSchema, registerSchema } from './auth.schemas';
import * as service from './auth.service';

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/register', asyncHandler(async (request, response) => {
    const body = registerSchema.parse(request.body);
    response.status(201).json(await service.register(body));
  }));

  router.post('/login', asyncHandler(async (request, response) => {
    const body = loginSchema.parse(request.body);
    response.json(await service.login(body));
  }));

  return router;
}
