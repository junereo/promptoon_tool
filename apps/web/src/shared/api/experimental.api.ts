import type {
  ExperimentalAccessSummaryResponse,
  ExperimentalFeedResponse,
  RedeemExperimentalInviteCodeResponse
} from '@promptoon/shared';

import { rootApiClient } from './client';

export const experimentalApi = {
  async getMyAccess(): Promise<ExperimentalAccessSummaryResponse> {
    const { data } = await rootApiClient.get('/experimental/me');
    return data;
  },

  async getMyFeed(): Promise<ExperimentalFeedResponse> {
    const { data } = await rootApiClient.get('/experimental/feed');
    return data;
  },

  async redeemInviteCode(code: string): Promise<RedeemExperimentalInviteCodeResponse> {
    const { data } = await rootApiClient.post('/experimental/redeem', { code });
    return data;
  }
};
