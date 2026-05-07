import type {
  ChannelHome,
  ChannelProfile,
  ChannelProfileUpdateResponse,
  ChannelSubscriptionStateResponse,
  UpdateChannelProfileRequest
} from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';

interface ChannelProfileImageUploadResponse {
  channel: ChannelProfile;
  home: ChannelHome;
}

export const channelApi = {
  async getChannelHome(channelSlug: string): Promise<ChannelHome> {
    const { data } = await publicRootApiClient.get(`/channels/${channelSlug}/home`);
    return data;
  },

  async getMyChannelHome(): Promise<ChannelHome> {
    const { data } = await rootApiClient.get('/me/channel');
    return data;
  },

  async getSubscriptionState(channelId: string): Promise<ChannelSubscriptionStateResponse> {
    const { data } = await rootApiClient.get(`/channels/${channelId}/subscription`);
    return data;
  },

  async subscribe(channelId: string): Promise<void> {
    await rootApiClient.post(`/channels/${channelId}/subscribe`);
  },

  async unsubscribe(channelId: string): Promise<void> {
    await rootApiClient.delete(`/channels/${channelId}/subscribe`);
  },

  async updateMyChannelProfile(payload: UpdateChannelProfileRequest): Promise<ChannelProfileUpdateResponse> {
    const { data } = await rootApiClient.patch('/me/channel/profile', payload);
    return data;
  },

  async uploadMyChannelCover(file: File): Promise<ChannelProfileImageUploadResponse> {
    const formData = new FormData();
    formData.append('cover', file);
    const { data } = await rootApiClient.post('/me/channel/cover', formData);
    return data;
  },

  async deleteMyChannelCover(): Promise<ChannelProfileImageUploadResponse> {
    const { data } = await rootApiClient.delete('/me/channel/cover');
    return data;
  },

  async uploadMyChannelAvatar(file: File): Promise<ChannelProfileImageUploadResponse> {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await rootApiClient.post('/me/channel/avatar', formData);
    return data;
  },

  async deleteMyChannelAvatar(): Promise<ChannelProfileImageUploadResponse> {
    const { data } = await rootApiClient.delete('/me/channel/avatar');
    return data;
  }
};
