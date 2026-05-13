import dotenv from 'dotenv';
import path from 'node:path';

const envMode =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
    ? process.env.NODE_ENV ?? 'development'
    : null;
const rootEnvDir = path.resolve(process.cwd(), '../..');
const appEnvDir = process.cwd();

dotenv.config({ path: path.resolve(rootEnvDir, '.env') });
if (envMode) {
  dotenv.config({ path: path.resolve(rootEnvDir, `.env.${envMode}`), override: true });
}
dotenv.config({ path: path.resolve(appEnvDir, '.env'), override: true });
if (envMode) {
  dotenv.config({ path: path.resolve(appEnvDir, `.env.${envMode}`), override: true });
}

function getRequiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  databaseUrl: getRequiredEnv('DATABASE_URL', 'postgresql://promptoon_user:promptoon_password@localhost:5432/promptoon_db'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.RECOMMENDATION_PORT ?? 4100),
  recommendationTokenSecret: getRequiredEnv(
    'RECOMMENDATION_TOKEN_SECRET',
    process.env.JWT_SECRET ?? 'promptoon-recommendation-dev-secret'
  )
};
