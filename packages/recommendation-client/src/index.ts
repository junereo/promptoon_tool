import type { RecommendationFeedRequest, RecommendationFeedResponse } from '@promptoon/recommendation-contract';
import { recommendationFeedResponseSchema } from '@promptoon/recommendation-contract';

export interface RecommendationClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class RecommendationClientError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RecommendationClientError';
    this.status = status;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function createRecommendationClient(options: RecommendationClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 800;
  const fetcher = options.fetchImpl ?? fetch;

  return {
    async recommendFeed(request: RecommendationFeedRequest): Promise<RecommendationFeedResponse> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetcher(`${baseUrl}/recommendations/v1/feed`, {
          body: JSON.stringify(request),
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new RecommendationClientError(`Recommendation API returned ${response.status}.`, response.status);
        }

        return recommendationFeedResponseSchema.parse(await response.json());
      } catch (error) {
        if (error instanceof RecommendationClientError) {
          throw error;
        }

        throw new RecommendationClientError(error instanceof Error ? error.message : 'Recommendation API request failed.');
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
