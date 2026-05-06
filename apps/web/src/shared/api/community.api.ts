import type {
  CommentsMetaResponse,
  CommunityComment,
  CommunityCommentListResponse,
  CommunityDiscourseCommentsResponse,
  CommunityDiscourseInteractionResponse,
  CommunityDiscourseScope,
  CommunityEmbedResponse,
  CreateCommunityDiscourseCommentRequest,
  CreateCommunityDiscourseCommentResponse
} from '@promptoon/shared';

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

  async getComments(publishId: string): Promise<CommunityCommentListResponse> {
    const { data } = await publicRootApiClient.get(`/community/publishes/${publishId}/comments`);
    return data;
  },

  async createComment(publishId: string, body: string): Promise<CommunityComment> {
    const { data } = await rootApiClient.post(`/community/publishes/${publishId}/comments`, { body });
    return data;
  },

  async createDiscourseThread(publishId: string): Promise<unknown> {
    const { data } = await rootApiClient.post(`/community/publishes/${publishId}/discourse-topic`);
    return data;
  },

  async getDiscourseComments(publishId: string, scope: CommunityDiscourseScope): Promise<CommunityDiscourseCommentsResponse> {
    const { data } = await publicRootApiClient.get(`/community/publishes/${publishId}/discourse/comments`, {
      params: { scope }
    });
    return data;
  },

  async getDiscourseInteraction(publishId: string): Promise<CommunityDiscourseInteractionResponse> {
    const { data } = await publicRootApiClient.get(`/community/publishes/${publishId}/discourse/interaction`);
    return data;
  },

  async likeDiscoursePublish(publishId: string): Promise<CommunityDiscourseInteractionResponse> {
    const { data } = await rootApiClient.post(`/community/publishes/${publishId}/discourse/like`);
    return data;
  },

  async unlikeDiscoursePublish(publishId: string): Promise<CommunityDiscourseInteractionResponse> {
    const { data } = await rootApiClient.delete(`/community/publishes/${publishId}/discourse/like`);
    return data;
  },

  async getDiscourseTopic(topicId: string): Promise<unknown> {
    const { data } = await publicRootApiClient.get(`/community/discourse/t/${topicId}`);
    return data;
  },

  async createDiscourseComment(
    publishId: string,
    input: CreateCommunityDiscourseCommentRequest
  ): Promise<CreateCommunityDiscourseCommentResponse> {
    const { data } = await rootApiClient.post(`/community/publishes/${publishId}/discourse/comments`, input);
    return data;
  },

  async likeDiscoursePost(postId: string): Promise<unknown> {
    const { data } = await rootApiClient.post(`/community/discourse/posts/${postId}/like`);
    return data;
  },

  async createEpisodeDiscussion(episodeId: string): Promise<void> {
    await rootApiClient.post(`/community/episodes/${episodeId}/discussion`);
  }
};
