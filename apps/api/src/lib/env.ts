import dotenv from 'dotenv';
import path from 'node:path';

for (const candidate of [path.resolve(process.cwd(), '../../.env'), path.resolve(process.cwd(), '.env')]) {
  dotenv.config({ path: candidate });
}

function getRequiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export const env = {
  databaseUrl: getRequiredEnv('DATABASE_URL', 'postgresql://promptoon_user:promptoon_password@localhost:5432/promptoon_db'),
  testDatabaseUrl: process.env.TEST_DATABASE_URL ?? null,
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  jwtRefreshSecret: getOptionalEnv('JWT_REFRESH_SECRET') ?? getRequiredEnv('JWT_SECRET'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'promptoon-api',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'promptoon-web',
  accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? '15m',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? '30d',
  refreshTokenTtlDays: Number(process.env.JWT_REFRESH_TOKEN_TTL_DAYS ?? 30),
  clientRedirectUrl: process.env.CLIENT_REDIRECT_URL ?? process.env.WEB_APP_URL ?? '/',
  kakao: {
    clientId: getOptionalEnv('KAKAO_REST_API_KEY') ?? getOptionalEnv('KAKAO_CLIENT_ID'),
    clientSecret: getOptionalEnv('KAKAO_CLIENT_SECRET'),
    redirectUri: getOptionalEnv('KAKAO_REDIRECT_URI')
  },
  discourse: {
    baseUrl: getOptionalEnv('DISCOURSE_BASE_URL'),
    apiKey: getOptionalEnv('DISCOURSE_API_KEY'),
    apiUser: getOptionalEnv('DISCOURSE_API_USER') ?? 'system',
    categoryId: getOptionalEnv('DISCOURSE_CATEGORY_ID'),
    origin: getOptionalEnv('DISCOURSE_ORIGIN')
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000)
};
