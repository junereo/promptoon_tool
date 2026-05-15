import type {
  PlatformAccessSummaryResponse,
  RedeemPlatformAccessCodeResponse
} from '@promptoon/shared';

import { rootApiClient } from './client';

export const platformAccessApi = {
  async getMyAccess(): Promise<PlatformAccessSummaryResponse> {
    const { data } = await rootApiClient.get('/platform-access/me');
    return data;
  },

  async redeemCode(code: string): Promise<RedeemPlatformAccessCodeResponse> {
    const { data } = await rootApiClient.post('/platform-access/redeem', { code });
    return data;
  }
};
