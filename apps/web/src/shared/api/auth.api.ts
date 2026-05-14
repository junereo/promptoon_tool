import type {
  AuthMeResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UpdateProfileResponse
} from '@promptoon/shared';

import { publicRootApiClient, rootApiClient } from './client';
import { ApiError } from './client';

export const isLocalCredentialAuthEnabled =
  import.meta.env.VITE_LOCAL_CREDENTIAL_AUTH_ENABLED === 'true' ||
  (import.meta.env.VITE_LOCAL_CREDENTIAL_AUTH_ENABLED === undefined && import.meta.env.DEV);

export const authApi = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    if (!isLocalCredentialAuthEnabled) {
      throw new ApiError('Local credential authentication is disabled.', 404);
    }

    const { data } = await publicRootApiClient.post('/auth/login', payload);
    return data;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    if (!isLocalCredentialAuthEnabled) {
      throw new ApiError('Local credential authentication is disabled.', 404);
    }

    const { data } = await publicRootApiClient.post('/auth/register', payload);
    return data;
  },

  async me(): Promise<AuthMeResponse> {
    const { data } = await rootApiClient.get('/auth/me');
    return data;
  },

  async updateProfile(payload: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const { data } = await rootApiClient.patch('/auth/me/profile', payload);
    return data;
  },

  async logout(): Promise<void> {
    await rootApiClient.post('/auth/logout');
  },

  async refresh(): Promise<AuthResponse> {
    const { data } = await publicRootApiClient.post('/auth/refresh');
    return data;
  },

  async getGoogleAuthorizationUrl(): Promise<string> {
    const { data } = await publicRootApiClient.get<{ authorizationUrl: string }>('/auth/google/start');
    return data.authorizationUrl;
  }
};
