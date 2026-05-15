import type {
  AdminDiscourseSummaryResponse,
  AdminExperimentalGrantListResponse,
  AdminExperimentalInviteCodeListResponse,
  AdminExperimentalTargetListResponse,
  AdminLandingResponse,
  AdminMeResponse,
  AdminPlatformAccessCodeListResponse,
  AdminPlatformAccessGrantListResponse,
  AdminProjectListResponse,
  AdminPublishListResponse,
  AdminTelemetrySummaryResponse,
  AdminUserListResponse,
  AdminUserRoleFilter,
  AdminUserSummary,
  CreateAdminExperimentalGrantRequest,
  CreateAdminExperimentalInviteCodeRequest,
  CreateAdminExperimentalInviteCodeResponse,
  CreateAdminExperimentalTargetRequest,
  CreateAdminLandingItemRequest,
  CreateAdminPlatformAccessCodeRequest,
  CreateAdminPlatformAccessCodeResponse,
  CreateAdminPlatformAccessGrantRequest,
  ExperimentalAccessGrant,
  ExperimentalAccessTarget,
  ExperimentalInviteCode,
  PatchAdminPlatformAccessGrantRequest,
  PatchAdminExperimentalGrantRequest,
  PatchAdminExperimentalTargetRequest,
  PatchAdminLandingConfigRequest,
  PatchAdminLandingItemRequest,
  PatchPlatformRoleRequest,
  PlatformAccessCode,
  PlatformAccessGrant,
  PatchStudioRoleRequest,
  UpdateAdminLandingItemOrderRequest
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
  },

  async getLanding(): Promise<AdminLandingResponse> {
    const { data } = await rootApiClient.get('/admin/landing');
    return data;
  },

  async updateLandingConfig(payload: PatchAdminLandingConfigRequest): Promise<AdminLandingResponse> {
    const { data } = await rootApiClient.patch('/admin/landing', payload);
    return data;
  },

  async createLandingItem(payload: CreateAdminLandingItemRequest): Promise<AdminLandingResponse['items'][number]> {
    const { data } = await rootApiClient.post('/admin/landing/items', payload);
    return data;
  },

  async updateLandingItem(itemId: string, payload: PatchAdminLandingItemRequest): Promise<AdminLandingResponse['items'][number]> {
    const { data } = await rootApiClient.patch(`/admin/landing/items/${itemId}`, payload);
    return data;
  },

  async updateLandingItemOrder(payload: UpdateAdminLandingItemOrderRequest): Promise<AdminLandingResponse> {
    const { data } = await rootApiClient.put('/admin/landing/items/order', payload);
    return data;
  },

  async deleteLandingItem(itemId: string): Promise<void> {
    await rootApiClient.delete(`/admin/landing/items/${itemId}`);
  },

  async listExperimentalTargets(): Promise<AdminExperimentalTargetListResponse> {
    const { data } = await rootApiClient.get('/admin/experimental/targets');
    return data;
  },

  async createExperimentalTarget(payload: CreateAdminExperimentalTargetRequest): Promise<ExperimentalAccessTarget> {
    const { data } = await rootApiClient.post('/admin/experimental/targets', payload);
    return data;
  },

  async updateExperimentalTarget(targetId: string, payload: PatchAdminExperimentalTargetRequest): Promise<ExperimentalAccessTarget> {
    const { data } = await rootApiClient.patch(`/admin/experimental/targets/${targetId}`, payload);
    return data;
  },

  async deleteExperimentalTarget(targetId: string): Promise<void> {
    await rootApiClient.delete(`/admin/experimental/targets/${targetId}`);
  },

  async listExperimentalGrants(targetId: string): Promise<AdminExperimentalGrantListResponse> {
    const { data } = await rootApiClient.get(`/admin/experimental/targets/${targetId}/grants`);
    return data;
  },

  async createExperimentalGrant(targetId: string, payload: CreateAdminExperimentalGrantRequest): Promise<ExperimentalAccessGrant> {
    const { data } = await rootApiClient.post(`/admin/experimental/targets/${targetId}/grants`, payload);
    return data;
  },

  async updateExperimentalGrant(grantId: string, payload: PatchAdminExperimentalGrantRequest): Promise<ExperimentalAccessGrant> {
    const { data } = await rootApiClient.patch(`/admin/experimental/grants/${grantId}`, payload);
    return data;
  },

  async listExperimentalInviteCodes(
    targetId: string,
    params: {
      historyLimit?: number;
      historyOffset?: number;
    } = {}
  ): Promise<AdminExperimentalInviteCodeListResponse> {
    const { data } = await rootApiClient.get(`/admin/experimental/targets/${targetId}/invite-codes`, { params });
    return data;
  },

  async createExperimentalInviteCodes(targetId: string, payload: CreateAdminExperimentalInviteCodeRequest): Promise<CreateAdminExperimentalInviteCodeResponse> {
    const { data } = await rootApiClient.post(`/admin/experimental/targets/${targetId}/invite-codes`, payload);
    return data;
  },

  async revokeExperimentalInviteCode(codeId: string): Promise<ExperimentalInviteCode> {
    const { data } = await rootApiClient.patch(`/admin/experimental/invite-codes/${codeId}`, { status: 'revoked' });
    return data;
  },

  async listPlatformAccessGrants(): Promise<AdminPlatformAccessGrantListResponse> {
    const { data } = await rootApiClient.get('/admin/platform-access/grants');
    return data;
  },

  async createPlatformAccessGrant(payload: CreateAdminPlatformAccessGrantRequest): Promise<PlatformAccessGrant> {
    const { data } = await rootApiClient.post('/admin/platform-access/grants', payload);
    return data;
  },

  async updatePlatformAccessGrant(grantId: string, payload: PatchAdminPlatformAccessGrantRequest): Promise<PlatformAccessGrant> {
    const { data } = await rootApiClient.patch(`/admin/platform-access/grants/${grantId}`, payload);
    return data;
  },

  async listPlatformAccessCodes(
    params: {
      historyLimit?: number;
      historyOffset?: number;
    } = {}
  ): Promise<AdminPlatformAccessCodeListResponse> {
    const { data } = await rootApiClient.get('/admin/platform-access/codes', { params });
    return data;
  },

  async createPlatformAccessCodes(payload: CreateAdminPlatformAccessCodeRequest): Promise<CreateAdminPlatformAccessCodeResponse> {
    const { data } = await rootApiClient.post('/admin/platform-access/codes', payload);
    return data;
  },

  async revokePlatformAccessCode(codeId: string): Promise<PlatformAccessCode> {
    const { data } = await rootApiClient.patch(`/admin/platform-access/codes/${codeId}`, { status: 'revoked' });
    return data;
  }
};
