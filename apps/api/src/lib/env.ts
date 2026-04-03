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

export const env = {
  databaseUrl: getRequiredEnv('DATABASE_URL', 'postgresql://promptoon_user:promptoon_password@localhost:5432/promptoon_db'),
  testDatabaseUrl: process.env.TEST_DATABASE_URL ?? null,
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  port: Number(process.env.PORT ?? 4000)
};
