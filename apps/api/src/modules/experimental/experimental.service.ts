import { createHash, randomBytes } from 'node:crypto';
import type {
  AdminExperimentalGrantListResponse,
  AdminExperimentalInviteCodeListResponse,
  AdminExperimentalTargetListResponse,
  CreateAdminExperimentalInviteCodeResponse,
  ExperimentalAccessSummaryResponse,
  ExperimentalFeedResponse,
  ExperimentalInviteCodeWithPlainText,
  RedeemExperimentalInviteCodeResponse
} from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as productRepository from '../promptoon-core/product.repository';
import * as repository from './experimental.repository';

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 16;
const DEFAULT_INVITE_CODE_TTL_DAYS = 30;
const MAX_CODE_GENERATION_ATTEMPTS = 10;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, '');
}

function hashInviteCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode, 'utf8').digest('hex');
}

function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';

  for (const byte of bytes) {
    code += INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length];
  }

  return code;
}

function formatInviteCode(normalizedCode: string): string {
  return normalizedCode.match(/.{1,4}/g)?.join('-') ?? normalizedCode;
}

function getCodeParts(normalizedCode: string): { prefix: string; suffix: string } {
  return {
    prefix: normalizedCode.slice(0, 4),
    suffix: normalizedCode.slice(-4)
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

async function assertTarget(targetId: string) {
  const target = await repository.getTarget(db, targetId);
  if (!target) {
    throw new HttpError(404, 'Experimental access target not found.');
  }
  return target;
}

export async function listTargets(): Promise<AdminExperimentalTargetListResponse> {
  return {
    targets: await repository.listTargets(db)
  };
}

export async function createTarget(
  input: {
    projectId?: string;
    publishId?: string;
    targetType: 'all' | 'project' | 'publish';
  },
  actorUserId: string
): Promise<AdminExperimentalTargetListResponse['targets'][number]> {
  let projectId: string | null | undefined = input.projectId;

  if (input.targetType === 'all') {
    projectId = null;
  } else if (input.targetType === 'publish') {
    if (!input.publishId) {
      throw new HttpError(400, 'publishId is required for publish targets.');
    }

    projectId = await repository.getProjectIdForPublish(db, input.publishId) ?? undefined;
    if (!projectId) {
      throw new HttpError(404, 'Published content not found.');
    }
  } else if (!projectId) {
    throw new HttpError(400, 'projectId is required for project targets.');
  } else if (!(await repository.projectExists(db, projectId))) {
    throw new HttpError(404, 'Project not found.');
  }

  const target = await repository.upsertTarget(db, {
    actorUserId,
    projectId,
    publishId: input.targetType === 'publish' ? input.publishId : null,
    targetType: input.targetType
  });

  if (!target) {
    throw new HttpError(404, 'Experimental access target not found.');
  }

  return target;
}

export async function updateTargetStatus(
  targetId: string,
  status: 'active' | 'disabled'
): Promise<AdminExperimentalTargetListResponse['targets'][number]> {
  const target = await repository.updateTargetStatus(db, {
    status,
    targetId
  });

  if (!target) {
    throw new HttpError(404, 'Experimental access target not found.');
  }

  return target;
}

export async function deleteTarget(targetId: string): Promise<void> {
  const deleted = await repository.deleteTarget(db, targetId);
  if (!deleted) {
    throw new HttpError(404, 'Experimental access target not found.');
  }
}

export async function listTargetGrants(targetId: string): Promise<AdminExperimentalGrantListResponse> {
  await assertTarget(targetId);
  return {
    grants: await repository.listGrants(db, targetId)
  };
}

export async function grantTargetAccess(
  targetId: string,
  loginId: string,
  actorUserId: string
): Promise<AdminExperimentalGrantListResponse['grants'][number]> {
  await assertTarget(targetId);
  const userId = await repository.getUserIdByLoginId(db, loginId.trim());
  if (!userId) {
    throw new HttpError(404, 'User not found.');
  }

  const grant = await repository.upsertManualGrant(db, {
    actorUserId,
    targetId,
    userId
  });
  if (!grant) {
    throw new HttpError(404, 'Experimental access grant not found.');
  }

  return grant;
}

export async function updateGrantStatus(
  grantId: string,
  status: 'active' | 'revoked'
): Promise<AdminExperimentalGrantListResponse['grants'][number]> {
  const grant = await repository.updateGrantStatus(db, {
    grantId,
    status
  });

  if (!grant) {
    throw new HttpError(404, 'Experimental access grant not found.');
  }

  return grant;
}

export async function listTargetInviteCodes(
  targetId: string,
  input: {
    historyLimit?: number;
    historyOffset?: number;
  } = {}
): Promise<AdminExperimentalInviteCodeListResponse> {
  await assertTarget(targetId);
  const historyLimit = Math.min(Math.max(input.historyLimit ?? 10, 1), 100);
  const historyOffset = Math.max(input.historyOffset ?? 0, 0);
  return {
    codes: await repository.listInviteCodes(db, { targetId, visibility: 'active' }),
    history: await repository.listInviteCodes(db, {
      limit: historyLimit,
      offset: historyOffset,
      targetId,
      visibility: 'history'
    }),
    historyLimit,
    historyOffset,
    historyTotal: await repository.countInviteCodes(db, { targetId, visibility: 'history' })
  };
}

async function createOneInviteCode(input: {
  actorUserId: string;
  expiresAt: string;
  maxRedemptions: number;
  targetId: string;
}): Promise<ExperimentalInviteCodeWithPlainText> {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const normalizedCode = generateInviteCode();
    const { prefix, suffix } = getCodeParts(normalizedCode);

    try {
      const created = await repository.insertInviteCode(db, {
        codeHash: hashInviteCode(normalizedCode),
        codePrefix: prefix,
        codeSuffix: suffix,
        createdBy: input.actorUserId,
        expiresAt: input.expiresAt,
        maxRedemptions: input.maxRedemptions,
        targetId: input.targetId
      });

      return {
        ...created,
        code: formatInviteCode(normalizedCode)
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new HttpError(500, 'Failed to generate a unique invite code.');
}

export async function createInviteCodes(
  targetId: string,
  input: {
    count?: number;
    expiresAt?: string;
    maxRedemptions?: number;
    mode: 'single_use_batch' | 'multi_use';
  },
  actorUserId: string
): Promise<CreateAdminExperimentalInviteCodeResponse> {
  await assertTarget(targetId);
  const expiresAt = input.expiresAt ?? addDays(new Date(), DEFAULT_INVITE_CODE_TTL_DAYS).toISOString();

  if (Number.isNaN(new Date(expiresAt).getTime())) {
    throw new HttpError(400, 'expiresAt must be a valid date.');
  }

  const count = input.mode === 'single_use_batch' ? Math.min(Math.max(input.count ?? 1, 1), 500) : 1;
  const maxRedemptions = input.mode === 'single_use_batch' ? 1 : Math.min(Math.max(input.maxRedemptions ?? 10, 1), 10000);
  const codes: ExperimentalInviteCodeWithPlainText[] = [];

  for (let index = 0; index < count; index += 1) {
    codes.push(await createOneInviteCode({
      actorUserId,
      expiresAt,
      maxRedemptions,
      targetId
    }));
  }

  return { codes };
}

export async function revokeInviteCode(codeId: string): Promise<AdminExperimentalInviteCodeListResponse['codes'][number]> {
  const code = await repository.revokeInviteCode(db, codeId);
  if (!code) {
    throw new HttpError(404, 'Experimental invite code not found.');
  }

  return code;
}

export async function getMyAccess(userId: string): Promise<ExperimentalAccessSummaryResponse> {
  const grants = await repository.listActiveGrantsForUser(db, userId);

  return {
    grantCount: grants.length,
    grants
  };
}

export async function getMyExperimentalFeed(userId: string): Promise<ExperimentalFeedResponse> {
  return {
    items: await productRepository.listExperimentalFeedItemsForUser(db, userId)
  };
}

export async function redeemInviteCode(code: string, userId: string): Promise<RedeemExperimentalInviteCodeResponse> {
  const normalizedCode = normalizeInviteCode(code);
  if (!/^[A-Z2-9]{16}$/.test(normalizedCode)) {
    throw new HttpError(400, 'Invalid invite code.');
  }

  return withTransaction(async (client) => {
    const inviteCode = await repository.getInviteCodeForUpdate(client, hashInviteCode(normalizedCode));
    if (!inviteCode) {
      throw new HttpError(400, 'Invalid invite code.');
    }

    if (inviteCode.target_status !== 'active') {
      throw new HttpError(400, 'This invite code is no longer available.');
    }

    if (inviteCode.status !== 'active' || inviteCode.expires_at.getTime() <= Date.now()) {
      throw new HttpError(400, 'This invite code has expired.');
    }

    if (inviteCode.redeemed_count >= inviteCode.max_redemptions) {
      throw new HttpError(400, 'This invite code has already been used.');
    }

    if (await repository.hasRedeemedInviteCode(client, { inviteCodeId: inviteCode.id, userId })) {
      throw new HttpError(400, 'This invite code has already been used by this account.');
    }

    const grant = await repository.upsertInviteGrant(client, {
      inviteCodeId: inviteCode.id,
      targetId: inviteCode.target_id,
      userId
    });
    if (!grant) {
      throw new HttpError(404, 'Experimental access grant not found.');
    }

    await repository.createInviteRedemption(client, {
      grantId: grant.id,
      inviteCodeId: inviteCode.id,
      userId
    });
    await repository.incrementInviteRedemptionCount(client, inviteCode.id);

    const target = await repository.getTarget(client, inviteCode.target_id);
    if (!target) {
      throw new HttpError(404, 'Experimental access target not found.');
    }

    return {
      grant,
      target
    };
  });
}

export async function assertPublishAccess(publishId: string, userId?: string): Promise<void> {
  if (await repository.canAccessPublish(db, { publishId, userId })) {
    return;
  }

  throw new HttpError(userId ? 403 : 401, 'Experimental content access is required.');
}
