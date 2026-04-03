import fs from 'node:fs/promises';
import path from 'node:path';

import { withTransaction } from './index';

interface MigrationRow {
  version: string;
}

function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, 'migrations'),
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'dist/db/migrations')
  ];

  for (const candidate of candidates) {
    try {
      const stat = require('node:fs').statSync(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Could not locate migrations directory.');
}

export async function runMigrations(): Promise<void> {
  const migrationsDir = resolveMigrationsDir();
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await withTransaction(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = await client.query<MigrationRow>('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(applied.rows.map((row) => row.version));

    for (const fileName of migrationFiles) {
      if (appliedVersions.has(fileName)) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, fileName), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [fileName]);
    }
  });
}

