import type { LandingResponse } from '@promptoon/shared';

import { publicRootApiClient } from './client';
import { getPromptoonAnonymousId } from '../lib/promptoon-telemetry';

function getAnonymousHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    'X-Promptoon-Anonymous-Id': getPromptoonAnonymousId()
  };
}

export const landingApi = {
  async getLanding(): Promise<LandingResponse> {
    const { data } = await publicRootApiClient.get('/landing', {
      headers: getAnonymousHeaders()
    });
    return data;
  }
};
