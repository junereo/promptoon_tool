import type { Publish } from './legacy';

export type StudioRole = 'studio_admin' | 'producer' | 'writer' | 'viewer';
export type ProjectRole = 'owner' | 'producer' | 'writer' | 'viewer';

export interface StudioMember {
  userId: string;
  role: StudioRole;
  createdAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: string;
}

export interface ProjectMemberSummary extends ProjectMember {
  loginId: string;
}

export interface ProjectMemberListResponse {
  members: ProjectMemberSummary[];
}

export interface UpsertProjectMemberRequest {
  loginId: string;
  role: Exclude<ProjectRole, 'owner'>;
}

export interface PatchProjectMemberRequest {
  role: Exclude<ProjectRole, 'owner'>;
}

export interface RebuildPublicProjectionsResponse {
  publishes: number;
  channels: number;
  series: number;
  feedItems: number;
  channelHomes: number;
  discussions: number;
}

export type ProjectAssetSource = 'project_thumbnail' | 'episode_cover' | 'cut_asset' | 'upload';

export type ProjectAssetStatus = 'active' | 'deleted' | 'replaced';

export type ProjectAssetHistoryAction = 'created' | 'metadata_updated' | 'replaced' | 'deleted';

export interface ProjectAssetHistoryItem {
  id: string;
  action: ProjectAssetHistoryAction;
  previousAssetUrl?: string | null;
  nextAssetUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface ProjectAssetSummary {
  assetId?: string;
  assetUrl: string;
  source: ProjectAssetSource;
  episodeId?: string | null;
  episodeTitle?: string | null;
  cutId?: string | null;
  cutTitle?: string | null;
  metadata?: Record<string, unknown>;
  currentVersion?: number;
  status?: ProjectAssetStatus;
  history?: ProjectAssetHistoryItem[];
  updatedAt: string;
}

export interface ProjectAssetListResponse {
  projectId: string;
  assets: ProjectAssetSummary[];
}

export interface ProjectPublishHistoryItem {
  publishId: string;
  episodeId: string;
  episodeTitle: string;
  episodeNo: number;
  versionNo: number;
  status: 'published';
  createdAt: string;
  channelId?: string | null;
  seriesId?: string | null;
}

export interface ProjectPublishHistoryResponse {
  projectId: string;
  publishes: ProjectPublishHistoryItem[];
}

export interface PatchProjectAssetRequest {
  metadata?: Record<string, unknown>;
}

export interface ProjectPublishDiffResponse {
  projectId: string;
  fromPublishId: string;
  toPublishId: string;
  fromVersionNo: number;
  toVersionNo: number;
  changedFields: string[];
  summary: {
    cutsAdded: number;
    cutsRemoved: number;
    cutsChanged: number;
    choicesAdded: number;
    choicesRemoved: number;
    choicesChanged: number;
  };
}

export interface ProjectPublishRollbackResponse {
  publish: Publish;
  diff: ProjectPublishDiffResponse;
}

export type {
  AnalyticsEpisodeResponse,
  AssetUploadResponse,
  CreateChoiceRequest,
  CreateCutRequest,
  CreateEpisodeRequest,
  CreateProjectRequest,
  EpisodeDraftResponse,
  PatchChoiceRequest,
  PatchCutRequest,
  PatchEpisodeRequest,
  PatchProjectRequest,
  Publish,
  PublishRequest,
  ValidateEpisodeResponse
} from './legacy';

export type { ProjectAnalyticsResponse } from './analytics';
