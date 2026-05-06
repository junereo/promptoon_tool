import type { CommentsMetaResponse, CommunityEmbedResponse } from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';

export const communityApi = {
  async getCommentsMeta(publishId: string): Promise<CommentsMetaResponse> {
    const { data } = await publicRootApiClient.get(`/community/publishes/${publishId}/comments-meta`);
    return data;
  },

  async getCommunityEmbed(publishId: string): Promise<CommunityEmbedResponse> {
    const { data } = await publicRootApiClient.get(`/community/publishes/${publishId}/embed`);
    return data;
  },

  async createDiscourseThread(publishId: string): Promise<unknown> {
    const { data } = await rootApiClient.post(`/community/publishes/${publishId}/discourse-topic`);
    return data;
  },

  async getDiscourseTopic(topicId: string): Promise<unknown> {
    const { data } = await publicRootApiClient.get(`/community/discourse/t/${topicId}`);
    return data;
  },

  async createDiscourseComment(publishId: string, raw: string): Promise<unknown> {
    const { data } = await rootApiClient.post(`/community/publishes/${publishId}/discourse/comments`, { raw });
    return data;
  },

  async createEpisodeDiscussion(episodeId: string): Promise<void> {
    await rootApiClient.post(`/community/episodes/${episodeId}/discussion`);
  }
};
