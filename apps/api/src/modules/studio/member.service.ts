import type { PatchProjectMemberRequest, ProjectMemberListResponse, UpsertProjectMemberRequest } from '@promptoon/shared';

import { db } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as repository from './access.repository';
import * as authorizationService from './authorization.service';

export async function listProjectMembers(projectId: string, userId: string): Promise<ProjectMemberListResponse> {
  await authorizationService.ensureProjectOwnedByUser(projectId, userId);

  return {
    members: await repository.listProjectMembers(db, projectId)
  };
}

export async function addProjectMember(
  projectId: string,
  request: UpsertProjectMemberRequest,
  userId: string
): Promise<ProjectMemberListResponse> {
  await authorizationService.ensureProjectOwnedByUser(projectId, userId);
  const targetUserId = authorizationService.assertExists(await repository.getUserIdByLoginId(db, request.loginId), 'User not found.');

  await repository.upsertProjectMember(db, {
    projectId,
    userId: targetUserId,
    role: request.role
  });

  return listProjectMembers(projectId, userId);
}

export async function updateProjectMember(
  projectId: string,
  targetUserId: string,
  request: PatchProjectMemberRequest,
  userId: string
): Promise<ProjectMemberListResponse> {
  await authorizationService.ensureProjectOwnedByUser(projectId, userId);
  const currentRole = await repository.getProjectMemberRole(db, {
    projectId,
    userId: targetUserId
  });
  if (!currentRole) {
    throw new HttpError(404, 'Project member not found.');
  }

  if (currentRole === 'owner') {
    throw new HttpError(400, 'Owner transfer is not supported.');
  }

  await repository.upsertProjectMember(db, {
    projectId,
    userId: targetUserId,
    role: request.role
  });

  return listProjectMembers(projectId, userId);
}

export async function deleteProjectMember(projectId: string, targetUserId: string, userId: string): Promise<ProjectMemberListResponse> {
  await authorizationService.ensureProjectOwnedByUser(projectId, userId);
  const currentRole = await repository.getProjectMemberRole(db, {
    projectId,
    userId: targetUserId
  });
  if (!currentRole) {
    throw new HttpError(404, 'Project member not found.');
  }

  if (currentRole === 'owner') {
    throw new HttpError(400, 'Owner removal is not supported.');
  }

  await repository.deleteProjectMember(db, {
    projectId,
    userId: targetUserId
  });

  return listProjectMembers(projectId, userId);
}
