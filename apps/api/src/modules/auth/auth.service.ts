import type { AuthMeResponse, AuthResponse, AuthUser, LoginRequest, RegisterRequest, StudioRole } from '@promptoon/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { db } from '../../db';
import { env } from '../../lib/env';
import { HttpError } from '../../lib/http-error';
import * as repository from './auth.repository';

const TOKEN_EXPIRES_IN = '7d';
const PASSWORD_SALT_ROUNDS = 10;

export interface AuthTokenPayload {
  sub: string;
  loginId: string;
  sid: string;
}

function createAuthResponse(user: AuthUser, session: import('@promptoon/shared').AuthSession): AuthResponse {
  return {
    token: jwt.sign({ loginId: user.loginId, sid: session.id }, env.jwtSecret, {
      expiresIn: TOKEN_EXPIRES_IN,
      subject: user.id
    }),
    user
  };
}

export async function verifyAccessToken(token: string): Promise<AuthTokenPayload> {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.loginId !== 'string' ||
    typeof decoded.sid !== 'string'
  ) {
    throw new HttpError(401, 'Invalid authentication token.');
  }

  const session = await repository.getActiveSession(db, {
    sessionId: decoded.sid,
    userId: decoded.sub
  });
  if (!session) {
    throw new HttpError(401, 'Authentication session is expired or invalid.');
  }

  return {
    sub: decoded.sub,
    loginId: decoded.loginId,
    sid: decoded.sid
  };
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const existingUser = await repository.getUserByLoginId(db, request.loginId);
  if (existingUser) {
    throw new HttpError(409, 'Login ID is already in use.');
  }

  const passwordHash = await bcrypt.hash(request.password, PASSWORD_SALT_ROUNDS);
  const user = await repository.createUser(db, {
    loginId: request.loginId,
    passwordHash
  });
  await repository.ensureStudioMember(db, user.id);
  const session = await repository.createSession(db, user.id);

  return createAuthResponse(user, session);
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const user = await repository.getUserByLoginId(db, request.loginId);
  if (!user) {
    throw new HttpError(401, 'Invalid login ID or password.');
  }

  const isPasswordValid = await bcrypt.compare(request.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new HttpError(401, 'Invalid login ID or password.');
  }

  const authUser = {
    id: user.id,
    loginId: user.loginId
  };
  await repository.ensureStudioMember(db, user.id);
  const session = await repository.createSession(db, user.id);

  return createAuthResponse(authUser, session);
}

export async function me(userId: string, sessionId: string): Promise<AuthMeResponse> {
  const user = await repository.getUserById(db, userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }
  const session = await repository.getActiveSession(db, {
    sessionId,
    userId
  });
  if (!session) {
    throw new HttpError(401, 'Authentication session is expired or invalid.');
  }

  return {
    user,
    studioRole: (await repository.getStudioRole(db, userId)) as StudioRole | null,
    session
  };
}

export async function logout(userId: string, sessionId: string): Promise<void> {
  await repository.deleteSession(db, {
    sessionId,
    userId
  });
}
