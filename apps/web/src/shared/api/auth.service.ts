import type { AuthResponse, LoginRequest, RegisterRequest } from '@promptoon/shared';

import { publicApiClient } from './client';

export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const { data } = await publicApiClient.post('/auth/login', payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const { data } = await publicApiClient.post('/auth/register', payload);
    return data;
  }
};
