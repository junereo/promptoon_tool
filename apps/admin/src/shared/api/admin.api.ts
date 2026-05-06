import type {
  AdminDiscourseSummaryResponse,
  AdminMeResponse,
  AdminProjectListResponse,
  AdminPublishListResponse,
  AdminTelemetrySummaryResponse,
  AdminUserListResponse,
  AdminUserRoleFilter,
  AdminUserSummary,
  PatchPlatformRoleRequest,
  PatchStudioRoleRequest
} from '@promptoon/shared';

import { rootApiClient } from './client';

export const adminApi = {
  async me(): Promise<AdminMeResponse> {
    const { data } = await rootApiClient.get('/admin/me');
    return data;
  },

  async listUsers(params: { query?: string; role?: AdminUserRoleFilter } = {}): Promise<AdminUserListResponse> {
    const { data } = await rootApiClient.get('/admin/users', { params });
    return data;
  },

  async updatePlatformRole(userId: string, payload: PatchPlatformRoleRequest): Promise<AdminUserSummary> {
    const { data } = await rootApiClient.patch(`/admin/users/${userId}/platform-role`, payload);
    return data;
  },

  async updateStudioRole(userId: string, payload: PatchStudioRoleRequest): Promise<AdminUserSummary> {
    const { data } = await rootApiClient.patch(`/admin/users/${userId}/studio-role`, payload);
    return data;
  },

  async listProjects(): Promise<AdminProjectListResponse> {
    const { data } = await rootApiClient.get('/admin/projects');
    return data;
  },

  async listPublishes(): Promise<AdminPublishListResponse> {
    const { data } = await rootApiClient.get('/admin/publishes');
    return data;
  },

  async getDiscourseSummary(): Promise<AdminDiscourseSummaryResponse> {
    const { data } = await rootApiClient.get('/admin/community/discourse');
    return data;
  },

  async getTelemetrySummary(): Promise<AdminTelemetrySummaryResponse> {
    const { data } = await rootApiClient.get('/admin/telemetry/summary');
    return data;
  }
};
