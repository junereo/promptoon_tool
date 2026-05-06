import type { AuthMeResponse, AuthResponse, AuthSession, AuthUser, LoginRequest, RegisterRequest, StudioRole } from '@promptoon/shared';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';

import { db, withTransaction } from '../../db';
import { env } from '../../lib/env';
import { HttpError } from '../../lib/http-error';
import * as repository from './auth.repository';

const PASSWORD_SALT_ROUNDS = 10;
const REFRESH_TOKEN_COOKIE_NAME = 'pt_refresh_token';
const ACCESS_TOKEN_COOKIE_NAME = 'pt_access_token';

export interface AuthTokenPayload {
  sub: string;
  loginId: string;
  sid: string;
}

export interface KakaoOAuthProfile {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export const authCookieNames = {
  access: ACCESS_TOKEN_COOKIE_NAME,
  refresh: REFRESH_TOKEN_COOKIE_NAME
};

export const authCookieOptions = {
  access: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: 15 * 60 * 1000
  },
  refresh: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  }
};

function getRefreshExpiresAt(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user: AuthUser, sessionId: string): string {
  const options: SignOptions = {
    expiresIn: env.accessTokenExpiresIn as SignOptions['expiresIn'],
    subject: user.id,
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  };

  return {
    token: jwt.sign({ loginId: user.loginId, sid: sessionId, typ: 'access' }, env.jwtSecret, options),
    user
  }.token;
}

function signRefreshToken(userId: string, sessionId: string): string {
  const options: SignOptions = {
    expiresIn: env.refreshTokenExpiresIn as SignOptions['expiresIn'],
    jwtid: sessionId,
    subject: userId,
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  };

  return jwt.sign({ sid: sessionId, typ: 'refresh' }, env.jwtRefreshSecret, options);
}

async function createAuthResponse(user: AuthUser): Promise<AuthResponse> {
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken(user.id, sessionId);
  const session = await repository.createSession(db, {
    sessionId,
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: getRefreshExpiresAt()
  });

  return {
    token: signAccessToken(user, session.id),
    refreshToken,
    session,
    user
  };
}

export async function verifyAccessToken(token: string): Promise<AuthTokenPayload> {
  const decoded = jwt.verify(token, env.jwtSecret, {
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.loginId !== 'string' ||
    typeof decoded.sid !== 'string' ||
    decoded.typ !== 'access'
  ) {
    throw new HttpError(401, 'Invalid authentication token.');
  }

  const currentUserId = await repository.resolveCurrentUserId(db, decoded.sub);
  const session = await repository.getActiveSession(db, {
    sessionId: decoded.sid,
    userId: currentUserId
  });
  if (!session) {
    throw new HttpError(401, 'Authentication session is expired or invalid.');
  }

  return {
    sub: currentUserId,
    loginId: decoded.loginId,
    sid: decoded.sid
  };
}

function verifyRefreshToken(token: string): { sub: string; sid: string; jti: string } {
  const decoded = jwt.verify(token, env.jwtRefreshSecret, {
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.sid !== 'string' ||
    typeof decoded.jti !== 'string' ||
    decoded.typ !== 'refresh' ||
    decoded.jti !== decoded.sid
  ) {
    throw new HttpError(401, 'Invalid refresh token.');
  }

  return {
    sub: decoded.sub,
    sid: decoded.sid,
    jti: decoded.jti
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

  const authUser = {
    id: user.id,
    loginId: user.loginId
  };

  return createAuthResponse(authUser);
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

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const payload = verifyRefreshToken(refreshToken);
  const currentUserId = await repository.resolveCurrentUserId(db, payload.sub);
  const session = await repository.getSessionById(db, payload.sid);

  if (!session || session.user_id !== currentUserId) {
    throw new HttpError(401, 'Refresh token is expired or invalid.');
  }

  if (session.revoked_at) {
    await repository.revokeAllSessionsForUser(db, session.user_id, 'refresh_token_reuse_detected');
    throw new HttpError(401, 'Refresh token was already rotated.');
  }

  if (session.expires_at.getTime() <= Date.now()) {
    await repository.revokeSession(db, {
      sessionId: session.id,
      userId: session.user_id,
      reason: 'refresh_token_expired'
    });
    throw new HttpError(401, 'Refresh token is expired or invalid.');
  }

  if (!session.token_hash || session.token_hash !== hashToken(refreshToken)) {
    await repository.revokeAllSessionsForUser(db, session.user_id, 'refresh_token_hash_mismatch');
    throw new HttpError(401, 'Refresh token is expired or invalid.');
  }

  const user = await repository.getUserById(db, session.user_id);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return withTransaction(async (client) => {
    const nextSessionId = randomUUID();
    const nextRefreshToken = signRefreshToken(user.id, nextSessionId);
    const nextSession = await repository.createSession(client, {
      sessionId: nextSessionId,
      userId: user.id,
      tokenHash: hashToken(nextRefreshToken),
      expiresAt: getRefreshExpiresAt()
    });
    await repository.revokeSession(client, {
      sessionId: session.id,
      userId: user.id,
      reason: 'rotated',
      replacedBySessionId: nextSession.id
    });

    return {
      token: signAccessToken(user, nextSession.id),
      refreshToken: nextRefreshToken,
      session: nextSession,
      user
    };
  });
}

function getKakaoConfig(): { clientId: string; redirectUri: string; clientSecret?: string } {
  if (!env.kakao.clientId || !env.kakao.redirectUri) {
    throw new HttpError(503, 'Kakao OAuth is not configured.');
  }

  return {
    clientId: env.kakao.clientId,
    redirectUri: env.kakao.redirectUri,
    ...(env.kakao.clientSecret ? { clientSecret: env.kakao.clientSecret } : {})
  };
}

export function getKakaoAuthorizationUrl(state?: string): string {
  const config = getKakaoConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state: state ?? randomUUID()
  });

  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

async function fetchKakaoProfile(code: string): Promise<KakaoOAuthProfile> {
  const config = getKakaoConfig();
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code
  });
  if (config.clientSecret) {
    tokenParams.set('client_secret', config.clientSecret);
  }

  const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    },
    body: tokenParams.toString()
  });
  if (!tokenResponse.ok) {
    throw new HttpError(502, 'Failed to exchange Kakao authorization code.');
  }
  const tokenJson = await tokenResponse.json() as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new HttpError(502, 'Kakao token response did not include an access token.');
  }

  const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`
    }
  });
  if (!profileResponse.ok) {
    throw new HttpError(502, 'Failed to fetch Kakao profile.');
  }
  const profileJson = await profileResponse.json() as {
    id?: number | string;
    kakao_account?: {
      email?: string;
      is_email_verified?: boolean;
      profile?: {
        nickname?: string;
        profile_image_url?: string;
      };
    };
    properties?: {
      nickname?: string;
      profile_image?: string;
    };
  };
  if (profileJson.id === undefined || profileJson.id === null) {
    throw new HttpError(502, 'Kakao profile response did not include an id.');
  }

  return {
    id: String(profileJson.id),
    email: profileJson.kakao_account?.email ?? null,
    emailVerified: profileJson.kakao_account?.is_email_verified ?? false,
    nickname: profileJson.kakao_account?.profile?.nickname ?? profileJson.properties?.nickname ?? null,
    profileImageUrl: profileJson.kakao_account?.profile?.profile_image_url ?? profileJson.properties?.profile_image ?? null
  };
}

export async function loginWithKakaoCode(code: string): Promise<AuthResponse> {
  const profile = await fetchKakaoProfile(code);
  const user = await withTransaction(async (client) => {
    const oauthUser = await repository.upsertOAuthUser(client, {
      provider: 'kakao',
      providerAccountId: profile.id,
      email: profile.emailVerified ? profile.email : null,
      displayName: profile.nickname,
      profileImageUrl: profile.profileImageUrl
    });
    return {
      id: oauthUser.id,
      loginId: oauthUser.loginId
    };
  });

  return createAuthResponse(user);
}
