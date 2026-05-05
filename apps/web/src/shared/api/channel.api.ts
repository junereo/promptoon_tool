import type { ChannelHome, ChannelSubscriptionStateResponse } from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';

export const channelApi = {
  async getChannelHome(channelSlug: string): Promise<ChannelHome> {
    const { data } = await publicRootApiClient.get(`/channels/${channelSlug}/home`);
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
  }
};
