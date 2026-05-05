import type { ProjectRole } from '@promptoon/shared';

import { db } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as repository from './access.repository';

export const PROJECT_READ_ROLES: ProjectRole[] = ['owner', 'producer', 'writer', 'viewer'];
export const PROJECT_WRITE_ROLES: ProjectRole[] = ['owner', 'producer', 'writer'];
export const PROJECT_PUBLISH_ROLES: ProjectRole[] = ['owner', 'producer'];
export const PROJECT_OWNER_ROLES: ProjectRole[] = ['owner'];

export function assertExists<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new HttpError(404, message);
  }

  return value;
}

export async function ensureStudioAdmin(userId: string): Promise<void> {
  const role = await repository.getStudioMemberRole(db, userId);
  if (role !== 'studio_admin') {
    throw new HttpError(403, 'Studio admin role is required.');
  }
}

export async function ensureProjectRole(projectId: string, userId: string, allowedRoles: ProjectRole[]): Promise<ProjectRole> {
  const ownerId = await repository.getProjectOwnerId(db, projectId);
  if (!ownerId) {
    throw new HttpError(404, 'Project not found.');
  }

  let role = await repository.getProjectMemberRole(db, {
    projectId,
    userId
  });

  if (!role && ownerId === userId) {
    role = 'owner';
    await repository.upsertProjectMember(db, {
      projectId,
      userId,
      role
    });
  }

  if (!role || !allowedRoles.includes(role)) {
    throw new HttpError(403, 'You do not have access to this project.');
  }

  return role;
}

export async function ensureProjectReadableByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_READ_ROLES);
}

export async function ensureProjectWritableByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_WRITE_ROLES);
}

export async function ensureProjectPublishableByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_PUBLISH_ROLES);
}

export async function ensureProjectOwnedByUser(projectId: string, userId: string): Promise<void> {
  await ensureProjectRole(projectId, userId, PROJECT_OWNER_ROLES);
}

export async function ensureEpisodeProjectRole(episodeId: string, userId: string, allowedRoles: ProjectRole[]): Promise<void> {
  const projectId = await repository.getEpisodeProjectId(db, episodeId);
  if (!projectId) {
    throw new HttpError(404, 'Episode not found.');
  }

  await ensureProjectRole(projectId, userId, allowedRoles);
}

export async function ensureCutProjectRole(cutId: string, userId: string, allowedRoles: ProjectRole[]): Promise<void> {
  const projectId = await repository.getCutProjectId(db, cutId);
  if (!projectId) {
    throw new HttpError(404, 'Cut not found.');
  }

  await ensureProjectRole(projectId, userId, allowedRoles);
}

export async function ensureChoiceProjectRole(choiceId: string, userId: string, allowedRoles: ProjectRole[]): Promise<void> {
  const projectId = await repository.getChoiceProjectId(db, choiceId);
  if (!projectId) {
    throw new HttpError(404, 'Choice not found.');
  }

  await ensureProjectRole(projectId, userId, allowedRoles);
}
