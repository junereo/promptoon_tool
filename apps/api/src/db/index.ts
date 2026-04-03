import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { env } from '../lib/env';

export interface DbExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<Row>>;
}

const connectionString = process.env.VITEST && env.testDatabaseUrl ? env.testDatabaseUrl : env.databaseUrl;

const pool = new Pool({
  connectionString
});

pool.on('error', (error) => {
  console.error('Unexpected database pool error', error);
});

export const db: DbExecutor = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) {
    return pool.query<Row>(text, values);
  }
};

export function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
