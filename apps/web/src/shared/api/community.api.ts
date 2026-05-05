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

  async createEpisodeDiscussion(episodeId: string): Promise<void> {
    await rootApiClient.post(`/community/episodes/${episodeId}/discussion`);
  }
};
