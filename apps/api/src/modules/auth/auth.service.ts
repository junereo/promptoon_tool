import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@promptoon/shared';
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
}

function createAuthResponse(user: AuthUser): AuthResponse {
  return {
    token: jwt.sign({ loginId: user.loginId }, env.jwtSecret, {
      expiresIn: TOKEN_EXPIRES_IN,
      subject: user.id
    }),
    user
  };
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (typeof decoded !== 'object' || decoded === null || typeof decoded.sub !== 'string' || typeof decoded.loginId !== 'string') {
    throw new HttpError(401, 'Invalid authentication token.');
  }

  return {
    sub: decoded.sub,
    loginId: decoded.loginId
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

  return createAuthResponse(user);
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

  return createAuthResponse({
    id: user.id,
    loginId: user.loginId
  });
}
