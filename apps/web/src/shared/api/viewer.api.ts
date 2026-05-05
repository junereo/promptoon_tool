import type { ProductPublish, RelatedShort, ViewerInteractionStateResponse } from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';

export const viewerApi = {
  async getPublishedEpisode(publishId: string): Promise<ProductPublish> {
    const { data } = await publicRootApiClient.get(`/viewer/publishes/${publishId}`);
    return data;
  },

  async getRelatedShorts(publishId: string): Promise<RelatedShort[]> {
    const { data } = await publicRootApiClient.get(`/viewer/publishes/${publishId}/related-shorts`);
    return data;
  },

  async getInteractionState(publishId: string): Promise<ViewerInteractionStateResponse> {
    const { data } = await rootApiClient.get(`/viewer/publishes/${publishId}/state`);
    return data;
  },

  async saveContinue(publishId: string, payload: { cutId?: string; progress?: number }): Promise<void> {
    await rootApiClient.post(`/viewer/publishes/${publishId}/continue`, payload);
  }
};
