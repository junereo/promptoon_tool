import type { QueryResult, QueryResultRow } from 'pg';

export interface DbExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
}
