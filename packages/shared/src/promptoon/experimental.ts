import type { FeedItem } from './feed';

export type ExperimentalAccessTargetType = 'all' | 'project' | 'publish';
export type ExperimentalAccessTargetStatus = 'active' | 'disabled';
export type ExperimentalAccessGrantStatus = 'active' | 'revoked';
export type ExperimentalAccessGrantSource = 'manual' | 'invite_code';
export type ExperimentalInviteCodeStatus = 'active' | 'revoked' | 'expired' | 'exhausted';
export type ExperimentalInviteCodeCreateMode = 'single_use_batch' | 'multi_use';

export interface ExperimentalAccessTarget {
  id: string;
  targetType: ExperimentalAccessTargetType;
  projectId?: string | null;
  projectTitle?: string | null;
  publishId?: string | null;
  episodeId?: string | null;
  episodeTitle?: string | null;
  status: ExperimentalAccessTargetStatus;
  grantCount: number;
  inviteCodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentalAccessGrant {
  id: string;
  targetId: string;
  userId: string;
  loginId: string;
  source: ExperimentalAccessGrantSource;
  sourceInviteCodeId?: string | null;
  status: ExperimentalAccessGrantStatus;
  grantedBy?: string | null;
  grantedAt: string;
  revokedAt?: string | null;
  updatedAt: string;
}

export interface ExperimentalInviteCode {
  id: string;
  targetId: string;
  maskedCode: string;
  status: ExperimentalInviteCodeStatus;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentalInviteCodeWithPlainText extends ExperimentalInviteCode {
  code: string;
}

export interface ExperimentalAccessSummaryResponse {
  grantCount: number;
  grants: ExperimentalAccessGrant[];
}

export interface ExperimentalFeedResponse {
  items: FeedItem[];
}

export interface RedeemExperimentalInviteCodeRequest {
  code: string;
}

export interface RedeemExperimentalInviteCodeResponse {
  grant: ExperimentalAccessGrant;
  target: ExperimentalAccessTarget;
}
