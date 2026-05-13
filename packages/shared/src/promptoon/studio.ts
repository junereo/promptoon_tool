import type { Publish } from './legacy';

export type StudioRole = 'studio_admin' | 'producer' | 'writer' | 'viewer';
export type ProjectRole = 'owner' | 'producer' | 'writer' | 'viewer';

export type StudioProjectKind = 'promptoon' | 'movingtoon' | 'hybrid';
export type StudioProjectStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type MovingtoonProcessingStatus = 'empty' | 'uploading' | 'processing' | 'ready' | 'failed';
export type StudioContentPublishStatus = 'draft' | 'scheduled' | 'published' | 'unpublished';
export type MovingtoonAspectRatio = '9:16' | '16:9' | '1:1';

export interface MovingtoonEpisodeSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  episodeNumber: number;
  originalVideoUrl: string | null;
  videoAssetId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  aspectRatio: MovingtoonAspectRatio;
  processingStatus: MovingtoonProcessingStatus;
  publishStatus: StudioContentPublishStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface MovingtoonProcessingJobSummary {
  id: string;
  episodeId: string;
  projectId: string;
  projectTitle: string;
  episodeTitle: string;
  status: MovingtoonProcessingStatus;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioProjectSummary {
  id: string;
  title: string;
  description: string | null;
  kind: StudioProjectKind;
  status: StudioProjectStatus;
  posterUrl: string | null;
  episodeCount: number;
  draftCount: number;
  publishedCount: number;
  movingtoonProcessingCount: number;
  movingtoonReadyCount: number;
  movingtoonFailedCount: number;
  updatedAt: string;
}

export interface StudioDashboardResponse {
  projects: StudioProjectSummary[];
  uploadQueue: MovingtoonProcessingJobSummary[];
}

export interface CreateMovingtoonEpisodeRequest {
  title: string;
  description?: string;
  episodeNumber: number;
  aspectRatio: MovingtoonAspectRatio;
}

export interface CreateMovingtoonEpisodeResponse {
  episode: MovingtoonEpisodeSummary;
  job: MovingtoonProcessingJobSummary | null;
}

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

export type ProjectAssetSource = 'project_thumbnail' | 'episode_cover' | 'cut_asset' | 'movingtoon_video' | 'movingtoon_thumbnail' | 'upload';

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
  status: 'published' | 'unpublished';
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
