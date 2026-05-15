import { createHash, randomBytes } from 'node:crypto';
import type {
  AdminPlatformAccessCodeListResponse,
  AdminPlatformAccessGrantListResponse,
  CreateAdminPlatformAccessCodeResponse,
  PlatformAccessCodeWithPlainText,
  PlatformAccessGrant,
  PlatformAccessSummaryResponse,
  RedeemPlatformAccessCodeResponse
} from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as repository from './platform-access.repository';

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_LENGTH = 16;
const DEFAULT_ACCESS_CODE_TTL_DAYS = 30;
const MAX_CODE_GENERATION_ATTEMPTS = 10;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function normalizePlatformAccessCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, '');
}

function hashPlatformAccessCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode, 'utf8').digest('hex');
}

function generatePlatformAccessCode(): string {
  const bytes = randomBytes(ACCESS_CODE_LENGTH);
  let code = '';

  for (const byte of bytes) {
    code += ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length];
  }

  return code;
}

function formatPlatformAccessCode(normalizedCode: string): string {
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

export async function getMyAccess(userId: string): Promise<PlatformAccessSummaryResponse> {
  const grant = await repository.getActiveGrantForUser(db, userId);

  return {
    hasAccess: Boolean(grant),
    grant
  };
}

export async function listGrants(): Promise<AdminPlatformAccessGrantListResponse> {
  return {
    grants: await repository.listGrants(db)
  };
}

export async function grantAccess(loginId: string, actorUserId: string): Promise<PlatformAccessGrant> {
  const userId = await repository.getUserIdByLoginId(db, loginId.trim());
  if (!userId) {
    throw new HttpError(404, 'User not found.');
  }

  const grant = await repository.upsertGrant(db, {
    grantedBy: actorUserId,
    source: 'manual',
    userId
  });
  if (!grant) {
    throw new HttpError(404, 'Platform access grant not found.');
  }

  return grant;
}

export async function updateGrantStatus(grantId: string, status: 'active' | 'revoked'): Promise<PlatformAccessGrant> {
  const grant = await repository.updateGrantStatus(db, {
    grantId,
    status
  });
  if (!grant) {
    throw new HttpError(404, 'Platform access grant not found.');
  }

  return grant;
}

export async function listCodes(
  input: {
    historyLimit?: number;
    historyOffset?: number;
  } = {}
): Promise<AdminPlatformAccessCodeListResponse> {
  const historyLimit = Math.min(Math.max(input.historyLimit ?? 10, 1), 100);
  const historyOffset = Math.max(input.historyOffset ?? 0, 0);

  return {
    codes: await repository.listCodes(db, { visibility: 'active' }),
    history: await repository.listCodes(db, {
      limit: historyLimit,
      offset: historyOffset,
      visibility: 'history'
    }),
    historyLimit,
    historyOffset,
    historyTotal: await repository.countCodes(db, { visibility: 'history' })
  };
}

async function createOneCode(input: {
  actorUserId: string;
  expiresAt: string;
  maxRedemptions: number;
}): Promise<PlatformAccessCodeWithPlainText> {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const normalizedCode = generatePlatformAccessCode();
    const { prefix, suffix } = getCodeParts(normalizedCode);

    try {
      const created = await repository.insertCode(db, {
        codeHash: hashPlatformAccessCode(normalizedCode),
        codePrefix: prefix,
        codeSuffix: suffix,
        createdBy: input.actorUserId,
        expiresAt: input.expiresAt,
        maxRedemptions: input.maxRedemptions
      });

      return {
        ...created,
        code: formatPlatformAccessCode(normalizedCode)
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new HttpError(500, 'Failed to generate a unique platform access code.');
}

export async function createCodes(
  input: {
    count?: number;
    expiresAt?: string;
    maxRedemptions?: number;
    mode: 'single_use_batch' | 'multi_use';
  },
  actorUserId: string
): Promise<CreateAdminPlatformAccessCodeResponse> {
  const expiresAt = input.expiresAt ?? addDays(new Date(), DEFAULT_ACCESS_CODE_TTL_DAYS).toISOString();

  if (Number.isNaN(new Date(expiresAt).getTime())) {
    throw new HttpError(400, 'expiresAt must be a valid date.');
  }

  const count = input.mode === 'single_use_batch' ? Math.min(Math.max(input.count ?? 1, 1), 500) : 1;
  const maxRedemptions = input.mode === 'single_use_batch' ? 1 : Math.min(Math.max(input.maxRedemptions ?? 10, 1), 10000);
  const codes: PlatformAccessCodeWithPlainText[] = [];

  for (let index = 0; index < count; index += 1) {
    codes.push(await createOneCode({
      actorUserId,
      expiresAt,
      maxRedemptions
    }));
  }

  return { codes };
}

export async function revokeCode(codeId: string) {
  const code = await repository.revokeCode(db, codeId);
  if (!code) {
    throw new HttpError(404, 'Platform access code not found.');
  }

  return code;
}

export async function redeemCode(code: string, userId: string): Promise<RedeemPlatformAccessCodeResponse> {
  const normalizedCode = normalizePlatformAccessCode(code);
  if (!/^[A-Z2-9]{16}$/.test(normalizedCode)) {
    throw new HttpError(400, 'Invalid platform access code.');
  }

  return withTransaction(async (client) => {
    const accessCode = await repository.getCodeForUpdate(client, hashPlatformAccessCode(normalizedCode));
    if (!accessCode) {
      throw new HttpError(400, 'Invalid platform access code.');
    }

    if (accessCode.status !== 'active' || accessCode.expires_at.getTime() <= Date.now()) {
      throw new HttpError(400, 'This platform access code has expired.');
    }

    if (accessCode.redeemed_count >= accessCode.max_redemptions) {
      throw new HttpError(400, 'This platform access code has already been used.');
    }

    if (await repository.hasRedeemedCode(client, { codeId: accessCode.id, userId })) {
      throw new HttpError(400, 'This platform access code has already been used by this account.');
    }

    const grant = await repository.upsertGrant(client, {
      source: 'code',
      sourceCodeId: accessCode.id,
      userId
    });
    if (!grant) {
      throw new HttpError(404, 'Platform access grant not found.');
    }

    await repository.createRedemption(client, {
      codeId: accessCode.id,
      grantId: grant.id,
      userId
    });
    await repository.incrementCodeRedemptionCount(client, accessCode.id);

    return {
      hasAccess: true,
      grant
    };
  });
}
