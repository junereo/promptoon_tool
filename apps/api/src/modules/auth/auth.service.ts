import type {
  AuthMeResponse,
  AuthResponse,
  AuthSession,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  StudioRole,
  UpdateProfileRequest
} from '@promptoon/shared';
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
const SESSION_HINT_COOKIE_NAME = 'pt_auth_session';

export interface AuthTokenPayload {
  sub: string;
  loginId: string;
  sid: string;
}

export interface GoogleOAuthProfile {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  profileImageUrl?: string | null;
}

export const authCookieNames = {
  access: ACCESS_TOKEN_COOKIE_NAME,
  refresh: REFRESH_TOKEN_COOKIE_NAME,
  sessionHint: SESSION_HINT_COOKIE_NAME
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
  },
  sessionHint: {
    httpOnly: false,
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
    loginId: user.loginId,
    displayName: user.displayName ?? null,
    authProvider: user.authProvider ?? 'local',
    snsProfileImageUrl: user.snsProfileImageUrl ?? null
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

export async function updateProfile(userId: string, request: UpdateProfileRequest): Promise<AuthUser> {
  const displayName = request.displayName.trim().replace(/\s+/g, ' ');
  const user = await repository.updateUserDisplayName(db, {
    userId,
    displayName
  });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  return user;
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

function getGoogleConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  if (!env.google.clientId || !env.google.clientSecret || !env.google.redirectUri) {
    throw new HttpError(503, 'Google OAuth is not configured.');
  }

  return {
    clientId: env.google.clientId,
    clientSecret: env.google.clientSecret,
    redirectUri: env.google.redirectUri
  };
}

export function getGoogleAuthorizationUrl(state?: string): string {
  const config = getGoogleConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid email profile',
    state: state ?? randomUUID()
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function fetchGoogleProfile(code: string): Promise<GoogleOAuthProfile> {
  const config = getGoogleConfig();
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: tokenParams.toString()
  });
  if (!tokenResponse.ok) {
    throw new HttpError(502, 'Failed to exchange Google authorization code.');
  }
  const tokenJson = await tokenResponse.json() as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new HttpError(502, 'Google token response did not include an access token.');
  }

  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`
    }
  });
  if (!profileResponse.ok) {
    throw new HttpError(502, 'Failed to fetch Google profile.');
  }
  const profileJson = await profileResponse.json() as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profileJson.sub) {
    throw new HttpError(502, 'Google profile response did not include a subject.');
  }

  return {
    id: profileJson.sub,
    email: profileJson.email ?? null,
    emailVerified: profileJson.email_verified ?? false,
    name: profileJson.name ?? null,
    profileImageUrl: profileJson.picture ?? null
  };
}

export async function loginWithGoogleCode(code: string): Promise<AuthResponse> {
  const profile = await fetchGoogleProfile(code);
  const user = await withTransaction(async (client) => {
    const oauthUser = await repository.upsertOAuthUser(client, {
      provider: 'google',
      providerAccountId: profile.id,
      email: profile.emailVerified ? profile.email : null,
      displayName: profile.name,
      profileImageUrl: profile.profileImageUrl
    });
    return {
      id: oauthUser.id,
      loginId: oauthUser.loginId,
      displayName: oauthUser.displayName ?? null,
      authProvider: oauthUser.authProvider ?? 'google',
      snsProfileImageUrl: oauthUser.snsProfileImageUrl ?? null
    };
  });

  return createAuthResponse(user);
}
