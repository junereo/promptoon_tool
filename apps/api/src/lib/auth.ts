import type { Request, RequestHandler } from 'express';

import { HttpError } from './http-error';
import { authCookieNames, verifyAccessToken, type AuthTokenPayload } from '../modules/auth/auth.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    loginId: string;
    sessionId: string;
  };
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.header('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    return match[1];
  }

  const cookieHeader = request.header('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = entry.trim().split('=');
    if (rawKey === authCookieNames.access) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const token = parseBearerToken(request);
  if (!token) {
    next(new HttpError(401, 'Authentication is required.'));
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      loginId: payload.loginId,
      sessionId: payload.sid
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid authentication token.'));
  }
};

export const optionalAuth: RequestHandler = async (request, _response, next) => {
  const token = parseBearerToken(request);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      loginId: payload.loginId,
      sessionId: payload.sid
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid authentication token.'));
  }
};

export function getOptionalAuthUser(request: Request): AuthTokenPayload | null {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    return null;
  }

  return {
    sub: user.id,
    loginId: user.loginId,
    sid: user.sessionId
  };
}

export function getRequiredAuthUser(request: Request): AuthTokenPayload {
  const user = (request as AuthenticatedRequest).user;
  if (!user) {
    throw new HttpError(401, 'Authentication is required.');
  }

  return {
    sub: user.id,
    loginId: user.loginId,
    sid: user.sessionId
  };
}
