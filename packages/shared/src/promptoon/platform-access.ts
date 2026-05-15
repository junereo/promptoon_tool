export type PlatformAccessGrantStatus = 'active' | 'revoked';
export type PlatformAccessGrantSource = 'manual' | 'code';
export type PlatformAccessCodeStatus = 'active' | 'revoked' | 'expired' | 'exhausted';
export type PlatformAccessCodeCreateMode = 'single_use_batch' | 'multi_use';

export interface PlatformAccessGrant {
  id: string;
  userId: string;
  loginId: string;
  source: PlatformAccessGrantSource;
  sourceCodeId?: string | null;
  status: PlatformAccessGrantStatus;
  grantedBy?: string | null;
  grantedAt: string;
  revokedAt?: string | null;
  updatedAt: string;
}

export interface PlatformAccessCode {
  id: string;
  maskedCode: string;
  status: PlatformAccessCodeStatus;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAccessCodeWithPlainText extends PlatformAccessCode {
  code: string;
}

export interface PlatformAccessSummaryResponse {
  hasAccess: boolean;
  grant?: PlatformAccessGrant | null;
}

export interface RedeemPlatformAccessCodeRequest {
  code: string;
}

export interface RedeemPlatformAccessCodeResponse {
  hasAccess: boolean;
  grant: PlatformAccessGrant;
}

export interface AdminPlatformAccessGrantListResponse {
  grants: PlatformAccessGrant[];
}

export interface CreateAdminPlatformAccessGrantRequest {
  loginId: string;
}

export interface PatchAdminPlatformAccessGrantRequest {
  status: PlatformAccessGrantStatus;
}

export interface AdminPlatformAccessCodeListResponse {
  codes: PlatformAccessCode[];
  history: PlatformAccessCode[];
  historyLimit: number;
  historyOffset: number;
  historyTotal: number;
}

export interface CreateAdminPlatformAccessCodeRequest {
  mode: PlatformAccessCodeCreateMode;
  count?: number;
  maxRedemptions?: number;
  expiresAt?: string;
}

export interface CreateAdminPlatformAccessCodeResponse {
  codes: PlatformAccessCodeWithPlainText[];
}
