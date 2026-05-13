import type { RecommendationFeedRequest, RecommendationFeedResponse } from '@promptoon/recommendation-contract';
import { applyProjectDiversity, LatestRanker, RuleRanker, type RecommendationCandidate } from '@promptoon/recommendation-rankers';
import { createHmac, randomUUID } from 'node:crypto';
import type { DbExecutor } from './db';
import * as repository from './repository';

const POLICY_ID = 'feed_rule_v1';
const MODEL_VERSION = 'rule_ranker_0.1.0';
const EXPERIMENT_ID = 'control';
const RESULT_POOL_MIN = 40;
const RESULT_POOL_MAX = 100;

export interface RecommendationServiceOptions {
  db: DbExecutor;
  tokenSecret: string;
}

interface CursorPayload {
  requestId: string;
  offset: number;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null | undefined): CursorPayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (typeof parsed.requestId !== 'string' || typeof parsed.offset !== 'number' || parsed.offset < 0) {
      return null;
    }

    return {
      requestId: parsed.requestId,
      offset: Math.floor(parsed.offset)
    };
  } catch {
    return null;
  }
}

function mergeCandidates(candidateGroups: RecommendationCandidate[][]): RecommendationCandidate[] {
  const byPublishId = new Map<string, RecommendationCandidate>();

  for (const candidate of candidateGroups.flat()) {
    const existing = byPublishId.get(candidate.publishId);
    if (!existing) {
      byPublishId.set(candidate.publishId, candidate);
      continue;
    }

    if (existing.source === 'latest' && candidate.source !== 'latest') {
      byPublishId.set(candidate.publishId, candidate);
    }
  }

  return Array.from(byPublishId.values());
}

function createTrackingToken(input: {
  requestId: string;
  publishId: string;
  rank: number;
  policyId: string;
  modelVersion: string;
  secret: string;
}): string {
  const payload = {
    r: input.requestId,
    p: input.publishId,
    k: input.rank,
    pol: input.policyId,
    m: input.modelVersion
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', input.secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function toResponse(
  input: {
    requestId: string;
    policyId: string;
    modelVersion: string;
    experimentId: string;
    items: repository.PersistedRecommendationResult[];
    nextCursor: string | null;
  }
): RecommendationFeedResponse {
  return {
    requestId: input.requestId,
    policyId: input.policyId,
    modelVersion: input.modelVersion,
    experimentId: input.experimentId,
    items: input.items.map((item) => ({
      publishId: item.publishId,
      rank: item.rank,
      score: item.score,
      source: item.source,
      reason: item.reason,
      trackingToken: item.trackingToken
    })),
    nextCursor: input.nextCursor
  };
}

export class RecommendationService {
  private readonly db: DbExecutor;
  private readonly tokenSecret: string;
  private readonly ruleRanker = new RuleRanker();
  private readonly latestRanker = new LatestRanker();

  constructor(options: RecommendationServiceOptions) {
    this.db = options.db;
    this.tokenSecret = options.tokenSecret;
  }

  async recommendFeed(request: RecommendationFeedRequest): Promise<RecommendationFeedResponse> {
    const cursor = decodeCursor(request.context.cursor);
    if (cursor) {
      const existingRequest = await repository.getRecommendationRequest(this.db, cursor.requestId);
      if (existingRequest) {
        const page = await repository.listRecommendationResults(this.db, {
          requestId: cursor.requestId,
          offset: cursor.offset,
          limit: request.context.limit + 1
        });
        const items = page.slice(0, request.context.limit);
        return toResponse({
          requestId: cursor.requestId,
          policyId: existingRequest.policy_id,
          modelVersion: existingRequest.model_version,
          experimentId: existingRequest.experiment_id,
          items,
          nextCursor: page.length > request.context.limit
            ? encodeCursor({ requestId: cursor.requestId, offset: cursor.offset + request.context.limit })
            : null
        });
      }
    }

    const requestId = randomUUID();
    const candidateLimit = Math.min(Math.max(request.context.limit * 4, RESULT_POOL_MIN), RESULT_POOL_MAX);
    const [latest, trending, exploration] = await Promise.all([
      repository.listCandidateFeedItems(this.db, request, 'latest', candidateLimit),
      repository.listCandidateFeedItems(this.db, request, 'trending', candidateLimit),
      repository.listCandidateFeedItems(this.db, request, 'exploration', Math.ceil(candidateLimit / 2))
    ]);
    const candidates = mergeCandidates([trending, exploration, latest]);
    const ranked = this.ruleRanker.rank(candidates);
    const fallbackRanked = ranked.length > 0 ? ranked : this.latestRanker.rank(latest);
    const diversified = applyProjectDiversity(fallbackRanked, candidateLimit);
    const persistedResults = diversified.map((item) => ({
      publishId: item.publishId,
      rank: item.rank,
      score: item.score,
      source: item.source,
      reason: item.reason,
      trackingToken: createTrackingToken({
        requestId,
        publishId: item.publishId,
        rank: item.rank,
        policyId: POLICY_ID,
        modelVersion: MODEL_VERSION,
        secret: this.tokenSecret
      })
    }));

    await repository.createRecommendationRequest(this.db, {
      requestId,
      request,
      policyId: POLICY_ID,
      modelVersion: MODEL_VERSION,
      experimentId: EXPERIMENT_ID
    });
    await repository.insertRecommendationResults(this.db, requestId, persistedResults);

    return toResponse({
      requestId,
      policyId: POLICY_ID,
      modelVersion: MODEL_VERSION,
      experimentId: EXPERIMENT_ID,
      items: persistedResults.slice(0, request.context.limit),
      nextCursor: persistedResults.length > request.context.limit
        ? encodeCursor({ requestId, offset: request.context.limit })
        : null
    });
  }
}

export function createRecommendationService(options: RecommendationServiceOptions): RecommendationService {
  return new RecommendationService(options);
}
