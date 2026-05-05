import { Router } from 'express';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
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

  router.get('/me', requireAuth, asyncHandler(async (request, response) => {
    const user = getRequiredAuthUser(request);
    response.json(await service.me(user.sub, user.sid));
  }));

  router.post('/logout', requireAuth, asyncHandler(async (request, response) => {
    const user = getRequiredAuthUser(request);
    await service.logout(user.sub, user.sid);
    response.status(204).send();
  }));

  router.get('/google/start', asyncHandler(async () => {
    throw new HttpError(501, 'Google OAuth is scaffolded but not configured.');
  }));

  router.get('/google/callback', asyncHandler(async () => {
    throw new HttpError(501, 'Google OAuth is scaffolded but not configured.');
  }));

  return router;
}
