import type { RankedRecommendationItem, Ranker, RecommendationCandidate } from './types';

export class LatestRanker implements Ranker {
  rank(candidates: RecommendationCandidate[]): RankedRecommendationItem[] {
    return [...candidates]
      .sort((left, right) => {
        const timeDelta = new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
        return timeDelta === 0 ? right.publishId.localeCompare(left.publishId) : timeDelta;
      })
      .map((candidate, index) => ({
        publishId: candidate.publishId,
        projectId: candidate.projectId,
        rank: index + 1,
        score: 1 / (index + 1),
        source: 'latest',
        reason: 'latest_fallback'
      }));
  }
}
