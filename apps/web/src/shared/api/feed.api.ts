import type { ContentInteractionStateListResponse, FeedHomeResponse, FeedItem, FeedResponse, FeedItemType } from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';

export const feedApi = {
  async getHome(): Promise<FeedHomeResponse> {
    const { data } = await publicRootApiClient.get('/feed/home');
    return data;
  },

  async getMixedFeed(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/mixed', { params });
    return data;
  },

  async getEpisodes(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/episodes', { params });
    return data;
  },

  async getShorts(params: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
    const { data } = await publicRootApiClient.get('/feed/shorts', { params });
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

  async likePublish(publishId: string): Promise<void> {
    await rootApiClient.post(`/feed/publishes/${publishId}/like`);
  },

  async unlikePublish(publishId: string): Promise<void> {
    await rootApiClient.delete(`/feed/publishes/${publishId}/like`);
  },

  async bookmarkPublish(publishId: string): Promise<void> {
    await rootApiClient.post(`/feed/publishes/${publishId}/bookmark`);
  },

  async unbookmarkPublish(publishId: string): Promise<void> {
    await rootApiClient.delete(`/feed/publishes/${publishId}/bookmark`);
  }
};
