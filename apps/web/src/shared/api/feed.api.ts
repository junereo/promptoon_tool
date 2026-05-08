import type { ContentInteractionStateListResponse, FeedHomeResponse, FeedItem, FeedRecommendationMeta, FeedResponse, FeedItemType } from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';
import { getPromptoonAnonymousId } from '../lib/promptoon-telemetry';

function getAnonymousHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    'X-Promptoon-Anonymous-Id': getPromptoonAnonymousId()
  };
}

function getRecommendationBody(recommendation?: FeedRecommendationMeta) {
  return recommendation
    ? {
        recommendation
      }
    : {};
}

export const feedApi = {
  async getHome(): Promise<FeedHomeResponse> {
    const { data } = await publicRootApiClient.get('/feed/home', {
      headers: getAnonymousHeaders()
    });
    return data;
  },

  async getMixedFeed(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/mixed', {
      headers: getAnonymousHeaders(),
      params
    });
    return data;
  },

  async getEpisodes(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/episodes', {
      headers: getAnonymousHeaders(),
      params
    });
    return data;
  },

  async getShorts(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/shorts', {
      headers: getAnonymousHeaders(),
      params
    });
    return data;
  },

  async getShort(publishId: string): Promise<FeedItem> {
    const { data } = await publicRootApiClient.get(`/feed/shorts/${publishId}`);
    return data;
  },

  async search(params: { cursor?: string; limit?: number; q?: string; type?: Exclude<FeedItemType, 'channel_recommendation'> | 'all' } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/search', { params });
    return data;
  },

  async getBookmarks(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await rootApiClient.get('/feed/bookmarks', { params });
    return data;
  },

  async getInteractionState(publishIds: string[]): Promise<ContentInteractionStateListResponse> {
    const { data } = await rootApiClient.get('/feed/state', {
      params: {
        publishIds: publishIds.join(',')
      }
    });
    return data;
  },

  async likePublish(publishId: string, recommendation?: FeedRecommendationMeta): Promise<void> {
    await rootApiClient.post(`/feed/publishes/${publishId}/like`, getRecommendationBody(recommendation));
  },

  async unlikePublish(publishId: string, recommendation?: FeedRecommendationMeta): Promise<void> {
    await rootApiClient.delete(`/feed/publishes/${publishId}/like`, {
      data: getRecommendationBody(recommendation)
    });
  },

  async bookmarkPublish(publishId: string, recommendation?: FeedRecommendationMeta): Promise<void> {
    await rootApiClient.post(`/feed/publishes/${publishId}/bookmark`, getRecommendationBody(recommendation));
  },

  async unbookmarkPublish(publishId: string, recommendation?: FeedRecommendationMeta): Promise<void> {
    await rootApiClient.delete(`/feed/publishes/${publishId}/bookmark`, {
      data: getRecommendationBody(recommendation)
    });
  }
};
