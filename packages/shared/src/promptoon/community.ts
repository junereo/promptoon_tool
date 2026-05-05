export interface EpisodeDiscussion {
  id: string;
  episodeId: string;
  publishId?: string | null;
  commentCount: number;
  latestCommentAt?: string | null;
  discussionUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentsMetaResponse {
  publishId: string;
  commentCount: number;
  latestCommentAt?: string | null;
  discussionUrl?: string | null;
  embedUrl?: string | null;
  managementUrl?: string | null;
}

export interface CommunityEmbedResponse extends CommentsMetaResponse {
  provider: 'promptoon' | 'discourse';
  title: string;
}

export type CommunityCommentStatus = 'visible' | 'hidden' | 'deleted';

export interface CommunityComment {
  id: string;
  publishId: string;
  discussionId?: string | null;
  userId?: string | null;
  body: string;
  status: CommunityCommentStatus;
  moderationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCommentListResponse {
  publishId: string;
  comments: CommunityComment[];
}

export interface CreateCommunityCommentRequest {
  body: string;
}

export interface PatchCommunityCommentRequest {
  body: string;
}

export interface ModerateCommunityCommentRequest {
  status: CommunityCommentStatus;
  reason?: string | null;
}

export type CommunityThreadSyncStatus = 'pending' | 'synced' | 'failed';

export interface DiscourseThreadSyncResponse {
  publishId: string;
  provider: 'discourse';
  status: CommunityThreadSyncStatus;
  discourseTopicId?: string | null;
  lastSyncedAt?: string | null;
  payload?: Record<string, unknown>;
}
