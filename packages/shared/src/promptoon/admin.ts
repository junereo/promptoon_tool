import type { AuthSession } from './auth';
import type {
  ExperimentalAccessGrant,
  ExperimentalAccessTarget,
  ExperimentalAccessTargetStatus,
  ExperimentalAccessTargetType,
  ExperimentalInviteCode,
  ExperimentalInviteCodeCreateMode,
  ExperimentalInviteCodeWithPlainText
} from './experimental';
import type { AuthUser } from './legacy';
import type { ProjectRole, StudioRole } from './studio';

export type PlatformRole = 'platform_admin';
export type AdminUserRoleFilter = 'all' | 'platform_admin' | 'studio_member' | 'no_studio';

export interface AdminMeResponse {
  user: AuthUser;
  session: AuthSession;
  platformRole: PlatformRole;
  studioRole?: StudioRole | null;
}

export interface AdminUserSummary {
  userId: string;
  loginId: string;
  email?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
  discourseUsername?: string | null;
  platformRole?: PlatformRole | null;
  studioRole?: StudioRole | null;
  projectCount: number;
  publishCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserListResponse {
  users: AdminUserSummary[];
  total: number;
}

export interface PatchPlatformRoleRequest {
  role: PlatformRole | null;
}

export interface PatchStudioRoleRequest {
  role: StudioRole | null;
}

export interface AdminProjectSummary {
  projectId: string;
  title: string;
  status: string;
  ownerId: string;
  ownerLoginId: string;
  episodeCount: number;
  publishCount: number;
  memberCount: number;
  latestPublishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProjectListResponse {
  projects: AdminProjectSummary[];
}

export interface AdminPublishSummary {
  publishId: string;
  projectId: string;
  projectTitle: string;
  episodeId: string;
  episodeTitle: string;
  episodeNo: number;
  versionNo: number;
  status: string;
  createdBy: string;
  createdByLoginId: string;
  channelId?: string | null;
  seriesId?: string | null;
  feedItemId?: string | null;
  discourseSyncStatus?: string | null;
  discourseTopicId?: string | null;
  createdAt: string;
}

export interface AdminPublishListResponse {
  publishes: AdminPublishSummary[];
}

export interface AdminDiscourseSyncStatusSummary {
  status: string;
  count: number;
}

export interface AdminDiscourseSyncItem {
  publishId: string;
  projectTitle: string;
  episodeTitle: string;
  syncStatus: string;
  discourseTopicId?: string | null;
  discoursePostId?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
}

export interface AdminDiscourseSummaryResponse {
  statuses: AdminDiscourseSyncStatusSummary[];
  latest: AdminDiscourseSyncItem[];
}

export interface AdminTelemetryEventSummary {
  eventName: string;
  count: number;
  latestAt?: string | null;
}

export interface AdminTelemetryDomainSummary {
  domain: string;
  count: number;
}

export interface AdminTelemetrySummaryResponse {
  totalEvents: number;
  events: AdminTelemetryEventSummary[];
  domains: AdminTelemetryDomainSummary[];
}

export interface AdminProjectMemberSummary {
  userId: string;
  loginId: string;
  role: ProjectRole;
}

export interface AdminExperimentalTargetListResponse {
  targets: ExperimentalAccessTarget[];
}

export interface CreateAdminExperimentalTargetRequest {
  targetType: ExperimentalAccessTargetType;
  projectId?: string;
  publishId?: string;
}

export interface PatchAdminExperimentalTargetRequest {
  status: ExperimentalAccessTargetStatus;
}

export interface AdminExperimentalGrantListResponse {
  grants: ExperimentalAccessGrant[];
}

export interface CreateAdminExperimentalGrantRequest {
  loginId: string;
}

export interface PatchAdminExperimentalGrantRequest {
  status: 'active' | 'revoked';
}

export interface AdminExperimentalInviteCodeListResponse {
  codes: ExperimentalInviteCode[];
  history: ExperimentalInviteCode[];
  historyLimit: number;
  historyOffset: number;
  historyTotal: number;
}

export interface CreateAdminExperimentalInviteCodeRequest {
  mode: ExperimentalInviteCodeCreateMode;
  count?: number;
  maxRedemptions?: number;
  expiresAt?: string;
}

export interface CreateAdminExperimentalInviteCodeResponse {
  codes: ExperimentalInviteCodeWithPlainText[];
}
