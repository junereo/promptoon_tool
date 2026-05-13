export type RecommendationCandidateSource = 'latest' | 'trending' | 'exploration';

export interface RecommendationCandidateMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface RecommendationCandidate {
  publishId: string;
  projectId: string;
  channelId: string | null;
  contentType: 'promptoon' | 'webtoon_episode' | 'short_drama';
  source: RecommendationCandidateSource;
  publishedAt: string;
  metrics: RecommendationCandidateMetrics;
  rankingScore: number;
}

export interface RankedRecommendationItem {
  publishId: string;
  projectId: string;
  rank: number;
  score: number;
  source: RecommendationCandidateSource;
  reason: string;
}

export interface Ranker {
  rank(candidates: RecommendationCandidate[]): RankedRecommendationItem[];
}
