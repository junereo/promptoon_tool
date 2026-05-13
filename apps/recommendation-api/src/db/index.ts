import type { QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { env } from '../lib/env';

const pool = new Pool({
  connectionString: env.databaseUrl
});

pool.on('error', (error) => {
  console.error('Unexpected recommendation database pool error', error);
});

export const db = {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>> {
    return pool.query<Row>(text, values);
  }
};

export async function closePool(): Promise<void> {
  await pool.end();
}
