import type { RankedRecommendationItem, Ranker, RecommendationCandidate } from './types';

const FRESHNESS_HALF_LIFE_HOURS = 72;

function hoursSince(value: string): number {
  const publishedAt = new Date(value).getTime();
  if (!Number.isFinite(publishedAt)) {
    return FRESHNESS_HALF_LIFE_HOURS;
  }

  return Math.max(0, (Date.now() - publishedAt) / (60 * 60 * 1000));
}

function normalize(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, value / max));
}

function freshnessScore(candidate: RecommendationCandidate): number {
  return 1 / (1 + hoursSince(candidate.publishedAt) / FRESHNESS_HALF_LIFE_HOURS);
}

function trendingRaw(candidate: RecommendationCandidate): number {
  return (
    candidate.rankingScore
    + candidate.metrics.views * 0.2
    + candidate.metrics.likes * 3
    + candidate.metrics.comments * 2
    + candidate.metrics.shares * 4
  );
}

function qualityRaw(candidate: RecommendationCandidate): number {
  const positiveSignals = candidate.metrics.likes * 3 + candidate.metrics.comments * 2 + candidate.metrics.shares * 4;
  return positiveSignals / (candidate.metrics.views + 10);
}

function explorationScore(candidate: RecommendationCandidate): number {
  const isFresh = hoursSince(candidate.publishedAt) <= 72;
  const isLowExposure = candidate.metrics.views <= 20;
  return candidate.source === 'exploration' || (isFresh && isLowExposure) ? 1 : 0;
}

function rankReason(candidate: RecommendationCandidate, scores: { trending: number; freshness: number; exploration: number }): string {
  if (scores.exploration >= 0.9) {
    return 'new_content';
  }

  if (scores.trending >= scores.freshness) {
    return 'trending_signal';
  }

  return 'fresh_content';
}

export class RuleRanker implements Ranker {
  rank(candidates: RecommendationCandidate[]): RankedRecommendationItem[] {
    const trendingMax = Math.max(0, ...candidates.map(trendingRaw));
    const qualityMax = Math.max(0, ...candidates.map(qualityRaw));

    return candidates
      .map((candidate) => {
        const freshness = freshnessScore(candidate);
        const trending = normalize(trendingRaw(candidate), trendingMax);
        const quality = normalize(qualityRaw(candidate), qualityMax);
        const exploration = explorationScore(candidate);
        const personalization = 0;
        const creatorAffinity = 0;
        const penalty = 0;
        const score =
          0.2 * freshness
          + 0.2 * quality
          + 0.2 * trending
          + 0.2 * personalization
          + 0.1 * exploration
          + 0.1 * creatorAffinity
          - penalty;

        return {
          publishId: candidate.publishId,
          projectId: candidate.projectId,
          rank: 0,
          score,
          source: candidate.source,
          reason: rankReason(candidate, { freshness, trending, exploration })
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.publishId.localeCompare(left.publishId);
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }
}
