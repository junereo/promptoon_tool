import type { Request, RequestHandler } from 'express';

import { HttpError } from './http-error';
import { verifyAccessToken, type AuthTokenPayload } from '../modules/auth/auth.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    loginId: string;
  };
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.header('authorization');
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export const requireAuth: RequestHandler = (request, _response, next) => {
  const token = parseBearerToken(request);
  if (!token) {
    next(new HttpError(401, 'Authentication is required.'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      loginId: payload.loginId
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid authentication token.'));
  }
};

export function getRequiredAuthUser(request: Request): AuthTokenPayload {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    throw new HttpError(401, 'Authentication is required.');
  }

  return {
    sub: user.id,
    loginId: user.loginId
  };
}
