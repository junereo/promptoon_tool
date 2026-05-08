import type { RecommendationContentType, RecommendationFeedRequest } from '@promptoon/recommendation-contract';
import type { RecommendationCandidate, RecommendationCandidateSource } from '@promptoon/recommendation-rankers';
import type { DbExecutor } from './db';

interface CandidateRow {
  publish_id: string;
  project_id: string;
  channel_id: string | null;
  item_type: RecommendationContentType;
  metrics_json: Partial<RecommendationCandidate['metrics']> | null;
  ranking_score: number;
  published_at: Date;
}

export interface RecommendationRequestRow {
  request_id: string;
  surface: string;
  policy_id: string;
  model_version: string;
  experiment_id: string;
}

export interface RecommendationResultRow {
  publish_id: string;
  rank: number;
  score: number;
  source: string;
  reason: string;
  tracking_token: string;
}

export interface PersistedRecommendationResult {
  publishId: string;
  rank: number;
  score: number;
  source: string;
  reason: string;
  trackingToken: string;
}

function normalizeMetrics(metrics: Partial<RecommendationCandidate['metrics']> | null): RecommendationCandidate['metrics'] {
  return {
    views: Number(metrics?.views ?? 0),
    likes: Number(metrics?.likes ?? 0),
    comments: Number(metrics?.comments ?? 0),
    shares: Number(metrics?.shares ?? 0)
  };
}

function mapCandidate(row: CandidateRow, source: RecommendationCandidateSource): RecommendationCandidate {
  return {
    publishId: row.publish_id,
    projectId: row.project_id,
    channelId: row.channel_id,
    contentType: row.item_type,
    source,
    publishedAt: row.published_at.toISOString(),
    metrics: normalizeMetrics(row.metrics_json),
    rankingScore: Number(row.ranking_score ?? 0)
  };
}

function buildCandidateFilters(input: RecommendationFeedRequest): { whereClause: string; values: unknown[] } {
  const values: unknown[] = [];
  const whereClauses = ['COALESCE(publish_id, movingtoon_publish_id) IS NOT NULL'];
  const contentTypes = input.constraints.contentTypes?.length
    ? input.constraints.contentTypes
    : ['promptoon', 'webtoon_episode', 'short_drama'];

  values.push(contentTypes);
  whereClauses.push(`item_type = ANY($${values.length}::text[])`);

  if (input.constraints.excludePublishIds.length > 0) {
    values.push(input.constraints.excludePublishIds);
    whereClauses.push(`NOT (COALESCE(publish_id, movingtoon_publish_id) = ANY($${values.length}::uuid[]))`);
  }

  return {
    whereClause: `WHERE ${whereClauses.join(' AND ')}`,
    values
  };
}

export async function listCandidateFeedItems(
  db: DbExecutor,
  input: RecommendationFeedRequest,
  source: RecommendationCandidateSource,
  limit: number
): Promise<RecommendationCandidate[]> {
  const { whereClause, values } = buildCandidateFilters(input);
  const nextValues = [...values];
  let sourceClause = '';
  let orderBy = 'ORDER BY published_at DESC, id DESC';

  if (source === 'trending') {
    orderBy = `ORDER BY (
      ranking_score
      + COALESCE((metrics_json->>'views')::double precision, 0) * 0.2
      + COALESCE((metrics_json->>'likes')::double precision, 0) * 3
      + COALESCE((metrics_json->>'comments')::double precision, 0) * 2
      + COALESCE((metrics_json->>'shares')::double precision, 0) * 4
    ) DESC, published_at DESC, id DESC`;
  } else if (source === 'exploration') {
    sourceClause = `AND published_at >= NOW() - INTERVAL '72 hours'
      AND COALESCE((metrics_json->>'views')::integer, 0) <= 20`;
    orderBy = 'ORDER BY published_at DESC, id DESC';
  }

  nextValues.push(limit);
  const result = await db.query<CandidateRow>(
    `SELECT
       COALESCE(publish_id, movingtoon_publish_id) AS publish_id,
       project_id,
       channel_id,
       item_type,
       metrics_json,
       ranking_score,
       published_at
     FROM promptoon_feed_item
     ${whereClause}
     ${sourceClause}
     ${orderBy}
     LIMIT $${nextValues.length}`,
    nextValues
  );

  return result.rows.map((row) => mapCandidate(row, source));
}

export async function createRecommendationRequest(
  db: DbExecutor,
  input: {
    requestId: string;
    request: RecommendationFeedRequest;
    policyId: string;
    modelVersion: string;
    experimentId: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_recommendation_request (
       request_id,
       user_id,
       anonymous_id,
       surface,
       device,
       locale,
       policy_id,
       model_version,
       experiment_id,
       cursor,
       limit_requested,
       constraints_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      input.requestId,
      input.request.user.userId ?? null,
      input.request.user.anonymousId ?? null,
      input.request.context.surface,
      input.request.context.device,
      input.request.context.locale,
      input.policyId,
      input.modelVersion,
      input.experimentId,
      input.request.context.cursor ?? null,
      input.request.context.limit,
      JSON.stringify(input.request.constraints)
    ]
  );
}

export async function getRecommendationRequest(db: DbExecutor, requestId: string): Promise<RecommendationRequestRow | null> {
  const result = await db.query<RecommendationRequestRow>(
    `SELECT request_id, surface, policy_id, model_version, experiment_id
     FROM promptoon_recommendation_request
     WHERE request_id = $1`,
    [requestId]
  );

  return result.rows[0] ?? null;
}

export async function insertRecommendationResults(
  db: DbExecutor,
  requestId: string,
  results: PersistedRecommendationResult[]
): Promise<void> {
  if (results.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders = results.map((result, index) => {
    const offset = index * 7;
    values.push(requestId, result.publishId, result.rank, result.score, result.source, result.reason, result.trackingToken);
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
  });

  await db.query(
    `INSERT INTO promptoon_recommendation_result (
       request_id,
       publish_id,
       rank,
       score,
       source,
       reason,
       tracking_token
     )
     VALUES ${placeholders.join(', ')}`,
    values
  );
}

export async function listRecommendationResults(
  db: DbExecutor,
  input: { requestId: string; offset: number; limit: number }
): Promise<PersistedRecommendationResult[]> {
  const result = await db.query<RecommendationResultRow>(
    `SELECT publish_id, rank, score, source, reason, tracking_token
     FROM promptoon_recommendation_result
     WHERE request_id = $1
     ORDER BY rank ASC
     OFFSET $2
     LIMIT $3`,
    [input.requestId, input.offset, input.limit]
  );

  return result.rows.map((row) => ({
    publishId: row.publish_id,
    rank: row.rank,
    score: Number(row.score),
    source: row.source,
    reason: row.reason,
    trackingToken: row.tracking_token
  }));
}
