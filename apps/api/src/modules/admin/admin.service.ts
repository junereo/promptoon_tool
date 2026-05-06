import type {
  AdminDiscourseSummaryResponse,
  AdminMeResponse,
  AdminProjectListResponse,
  AdminPublishListResponse,
  AdminTelemetrySummaryResponse,
  AdminUserListResponse,
  AdminUserRoleFilter,
  PatchPlatformRoleRequest,
  PatchStudioRoleRequest,
  PlatformRole
} from '@promptoon/shared';

import { db } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as authService from '../auth/auth.service';
import * as repository from './admin.repository';

function getBootstrapLoginIds(): Set<string> {
  return new Set(
    (process.env.PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

async function bootstrapPlatformAdminIfAllowed(userId: string, loginId: string): Promise<PlatformRole | null> {
  const bootstrapLoginIds = getBootstrapLoginIds();
  if (!bootstrapLoginIds.has(loginId)) {
    return null;
  }

  await repository.upsertPlatformAdmin(db, {
    userId,
    grantedBy: userId
  });
  return 'platform_admin';
}

export async function ensurePlatformAdmin(userId: string, loginId: string): Promise<PlatformRole> {
  const existingRole = await repository.getPlatformAdminRole(db, userId);
  if (existingRole === 'platform_admin') {
    return existingRole;
  }

  const bootstrappedRole = await bootstrapPlatformAdminIfAllowed(userId, loginId);
  if (bootstrappedRole) {
    return bootstrappedRole;
  }

  throw new HttpError(403, 'Platform admin role is required.');
}

export async function me(userId: string, sessionId: string): Promise<AdminMeResponse> {
  const authMe = await authService.me(userId, sessionId);
  const platformRole = await ensurePlatformAdmin(userId, authMe.user.loginId);

  return {
    ...authMe,
    platformRole
  };
}

export async function listUsers(input: {
  query?: string;
  role?: AdminUserRoleFilter;
  limit?: number;
  offset?: number;
}): Promise<AdminUserListResponse> {
  return repository.listUsers(db, {
    query: input.query,
    role: input.role ?? 'all',
    limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
    offset: Math.max(input.offset ?? 0, 0)
  });
}

export async function updatePlatformRole(
  targetUserId: string,
  request: PatchPlatformRoleRequest,
  actorUserId: string
): Promise<AdminUserListResponse['users'][number]> {
  const targetLoginId = await repository.getUserLoginId(db, targetUserId);
  if (!targetLoginId) {
    throw new HttpError(404, 'User not found.');
  }

  if (request.role === 'platform_admin') {
    await repository.upsertPlatformAdmin(db, {
      userId: targetUserId,
      grantedBy: actorUserId
    });
  } else {
    if (getBootstrapLoginIds().has(targetLoginId)) {
      throw new HttpError(400, 'Bootstrap platform admin cannot be revoked while configured in PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS.');
    }

    if (targetUserId === actorUserId && (await repository.countPlatformAdmins(db)) <= 1) {
      throw new HttpError(400, 'At least one platform admin is required.');
    }

    await repository.deletePlatformAdmin(db, targetUserId);
  }

  const updated = await repository.getUserSummaryById(db, targetUserId);
  if (!updated) {
    throw new HttpError(404, 'User not found.');
  }
  return updated;
}

export async function updateStudioRole(targetUserId: string, request: PatchStudioRoleRequest): Promise<AdminUserListResponse['users'][number]> {
  const targetLoginId = await repository.getUserLoginId(db, targetUserId);
  if (!targetLoginId) {
    throw new HttpError(404, 'User not found.');
  }

  if (request.role) {
    await repository.upsertStudioRole(db, {
      userId: targetUserId,
      role: request.role
    });
  } else {
    await repository.deleteStudioRole(db, targetUserId);
  }

  const updated = await repository.getUserSummaryById(db, targetUserId);
  if (!updated) {
    throw new HttpError(404, 'User not found.');
  }
  return updated;
}

export async function listProjects(): Promise<AdminProjectListResponse> {
  return repository.listProjects(db);
}

export async function listPublishes(): Promise<AdminPublishListResponse> {
  return repository.listPublishes(db);
}

export async function getDiscourseSummary(): Promise<AdminDiscourseSummaryResponse> {
  return repository.getDiscourseSummary(db);
}

export async function getTelemetrySummary(): Promise<AdminTelemetrySummaryResponse> {
  return repository.getTelemetrySummary(db);
}
