import type { AuthMeResponse, AuthResponse, LoginRequest, RegisterRequest } from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const { data } = await publicRootApiClient.post('/auth/login', payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const { data } = await publicRootApiClient.post('/auth/register', payload);
    return data;
  },

  async me(): Promise<AuthMeResponse> {
    const { data } = await rootApiClient.get('/auth/me');
    return data;
  },

  async logout(): Promise<void> {
    await rootApiClient.post('/auth/logout');
  },

  async refresh(): Promise<AuthResponse> {
    const { data } = await publicRootApiClient.post('/auth/refresh');
    return data;
  },

  async getKakaoAuthorizationUrl(): Promise<string> {
    const { data } = await publicRootApiClient.get<{ authorizationUrl: string }>('/auth/kakao/start');
    return data.authorizationUrl;
  }
};
