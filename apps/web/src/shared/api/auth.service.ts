import type { AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, UpdateProfileResponse } from '@promptoon/shared';

import { authApi } from './auth.api';

export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    return authApi.login(payload);
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    return authApi.register(payload);
  },

  async updateProfile(payload: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    return authApi.updateProfile(payload);
  },

  async refresh(): Promise<AuthResponse> {
    return authApi.refresh();
  },

  async getGoogleAuthorizationUrl(): Promise<string> {
    return authApi.getGoogleAuthorizationUrl();
  }
};
