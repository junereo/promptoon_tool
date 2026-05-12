import type { AuthResponse, LoginRequest, RegisterRequest } from '@promptoon/shared';

import { authApi } from './auth.api';

export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    return authApi.login(payload);
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    return authApi.register(payload);
  },

  async refresh(): Promise<AuthResponse> {
    return authApi.refresh();
  },

  async getGoogleAuthorizationUrl(): Promise<string> {
    return authApi.getGoogleAuthorizationUrl();
  }
};
