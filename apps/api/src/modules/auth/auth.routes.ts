import { Router } from 'express';
import type { Response } from 'express';
import type { AuthResponse } from '@promptoon/shared';
import { z } from 'zod';

import { asyncHandler } from '../../lib/async-handler';
import { getRequiredAuthUser, requireAuth } from '../../lib/auth';
import { HttpError } from '../../lib/http-error';
import { loginSchema, registerSchema } from './auth.schemas';
import * as service from './auth.service';

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1).optional()
});

const googleCallbackSchema = z.object({
  code: z.string().trim().min(1)
});

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = entry.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

function setAuthCookies(response: Response, payload: AuthResponse): void {
  response.cookie(service.authCookieNames.access, payload.token, service.authCookieOptions.access);
  if (payload.refreshToken) {
    response.cookie(service.authCookieNames.refresh, payload.refreshToken, service.authCookieOptions.refresh);
  }
}

function clearAuthCookies(response: Response): void {
  const { maxAge: _accessMaxAge, ...accessOptions } = service.authCookieOptions.access;
  const { maxAge: _refreshMaxAge, ...refreshOptions } = service.authCookieOptions.refresh;
  response.clearCookie(service.authCookieNames.access, accessOptions);
  response.clearCookie(service.authCookieNames.refresh, refreshOptions);
}

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/register', asyncHandler(async (request, response) => {
    const body = registerSchema.parse(request.body);
    const payload = await service.register(body);
    setAuthCookies(response, payload);
    response.status(201).json(payload);
  }));

  router.post('/login', asyncHandler(async (request, response) => {
    const body = loginSchema.parse(request.body);
    const payload = await service.login(body);
    setAuthCookies(response, payload);
    response.json(payload);
  }));

  router.get('/me', requireAuth, asyncHandler(async (request, response) => {
    const user = getRequiredAuthUser(request);
    response.json(await service.me(user.sub, user.sid));
  }));

  router.post('/logout', requireAuth, asyncHandler(async (request, response) => {
    const user = getRequiredAuthUser(request);
    await service.logout(user.sub, user.sid);
    clearAuthCookies(response);
    response.status(204).send();
  }));

  router.post('/refresh', asyncHandler(async (request, response) => {
    const body = refreshSchema.parse(request.body ?? {});
    const headerRefreshToken = request.header('x-refresh-token') ?? undefined;
    const cookieRefreshToken = getCookieValue(request.header('cookie'), service.authCookieNames.refresh) ?? undefined;
    const refreshToken = body.refreshToken ?? headerRefreshToken ?? cookieRefreshToken;
    if (!refreshToken) {
      throw new HttpError(401, 'Refresh token is required.');
    }

    const payload = await service.refresh(refreshToken);
    setAuthCookies(response, payload);
    response.json(payload);
  }));

  router.get('/google/start', asyncHandler(async (request, response) => {
    const authorizationUrl = service.getGoogleAuthorizationUrl(typeof request.query.state === 'string' ? request.query.state : undefined);
    if (request.query.redirect === '1') {
      response.redirect(302, authorizationUrl);
      return;
    }
    response.json({ authorizationUrl });
  }));

  router.get('/google/callback', asyncHandler(async (request, response) => {
    const code = googleCallbackSchema.parse({
      code: typeof request.query.code === 'string' ? request.query.code : ''
    }).code;
    const payload = await service.loginWithGoogleCode(code);
    setAuthCookies(response, payload);

    if (request.query.format === 'json') {
      response.json(payload);
      return;
    }

    response.redirect(302, envSafeRedirectUrl(typeof request.query.state === 'string' ? request.query.state : undefined));
  }));

  router.post('/google/callback', asyncHandler(async (request, response) => {
    const body = googleCallbackSchema.parse(request.body);
    const payload = await service.loginWithGoogleCode(body.code);
    setAuthCookies(response, payload);
    response.json(payload);
  }));

  return router;
}

function envSafeRedirectUrl(state?: string): string {
  if (state === 'admin') {
    return process.env.ADMIN_CLIENT_REDIRECT_URL ?? process.env.ADMIN_APP_URL ?? process.env.CLIENT_REDIRECT_URL ?? process.env.WEB_APP_URL ?? '/';
  }

  return process.env.CLIENT_REDIRECT_URL ?? process.env.WEB_APP_URL ?? '/';
}
