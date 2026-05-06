import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

function getRequiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

const discourseApiKey = getOptionalEnv('DISCOURSE_API_KEY', 'VITE_DISCOURSE_API_KEY');
const discourseBaseUrl =
  getOptionalEnv('DISCOURSE_BASE_URL', 'VITE_DISCOURSE_BASE_URL', 'VITE_DISCOURSE_URL') ??
  (discourseApiKey && (process.env.NODE_ENV ?? 'development') !== 'production' ? 'http://127.0.0.1:3000' : null);
const isDevelopment = (process.env.NODE_ENV ?? 'development') !== 'production';
const discourseCategoryId =
  getOptionalEnv('DISCOURSE_CATEGORY_ID', 'VITE_DISCOURSE_CATEGORY_ID') ??
  (isDevelopment && discourseBaseUrl && /localhost|127\.0\.0\.1/.test(discourseBaseUrl) ? '7' : null);

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
    baseUrl: discourseBaseUrl,
    apiKey: discourseApiKey,
    apiUser: getOptionalEnv('DISCOURSE_API_USER', 'VITE_DISCOURSE_API_USER') ?? 'system',
    categoryId: discourseCategoryId,
    origin: getOptionalEnv('DISCOURSE_ORIGIN', 'VITE_DISCOURSE_ORIGIN')
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000)
};
