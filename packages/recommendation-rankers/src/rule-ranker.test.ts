import { applyProjectDiversity, RuleRanker, type RecommendationCandidate } from '.';
import { describe, expect, it } from 'vitest';

function candidate(input: Partial<RecommendationCandidate> & Pick<RecommendationCandidate, 'publishId'>): RecommendationCandidate {
  return {
    publishId: input.publishId,
    projectId: input.projectId ?? input.publishId,
    channelId: input.channelId ?? null,
    contentType: input.contentType ?? 'promptoon',
    source: input.source ?? 'latest',
    publishedAt: input.publishedAt ?? new Date().toISOString(),
    metrics: input.metrics ?? {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    },
    rankingScore: input.rankingScore ?? 0
  };
}

describe('RuleRanker', () => {
  it('uses engagement signals instead of returning latest-only order', () => {
    const ranker = new RuleRanker();
    const oldTrending = candidate({
      publishId: '00000000-0000-4000-8000-000000000001',
      publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      metrics: {
        views: 1000,
        likes: 200,
        comments: 40,
        shares: 30
      },
      rankingScore: 10,
      source: 'trending'
    });
    const freshQuiet = candidate({
      publishId: '00000000-0000-4000-8000-000000000002',
      publishedAt: new Date().toISOString()
    });

    expect(ranker.rank([freshQuiet, oldTrending])[0]?.publishId).toBe(oldTrending.publishId);
  });

  it('keeps duplicate projects out of the first pass and fills with overflow', () => {
    const ranked = [
      { publishId: 'a', projectId: 'p1', rank: 1, score: 1, source: 'trending' as const, reason: 'trending_signal' },
      { publishId: 'b', projectId: 'p1', rank: 2, score: 0.9, source: 'latest' as const, reason: 'fresh_content' },
      { publishId: 'c', projectId: 'p2', rank: 3, score: 0.8, source: 'latest' as const, reason: 'fresh_content' }
    ];

    expect(applyProjectDiversity(ranked, 3).map((item) => item.publishId)).toEqual(['a', 'c', 'b']);
  });
});
