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
  discourseTopicId?: string | null;
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

export type CommunityDiscourseScope = 'project' | 'episode';

export type CommunityDiscoursePostSource = 'project' | 'episode';

export interface CommunityDiscourseTopicSummary {
  topicId: string;
  source: CommunityDiscoursePostSource;
  title: string;
  label: string;
  publishId?: string | null;
  episodeId?: string | null;
  episodeTitle?: string | null;
}

export interface CommunityDiscoursePost {
  id: string;
  topicId: string;
  postNumber: number;
  replyToPostNumber?: number | null;
  source: CommunityDiscoursePostSource;
  label: string;
  publishId?: string | null;
  episodeId?: string | null;
  episodeTitle?: string | null;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  cooked: string;
  createdAt: string;
  updatedAt?: string | null;
  likeCount: number;
  replyCount: number;
}

export interface CommunityDiscourseCommentsResponse {
  publishId: string;
  projectId: string;
  scope: CommunityDiscourseScope;
  title: string;
  commentCount: number;
  topics: CommunityDiscourseTopicSummary[];
  posts: CommunityDiscoursePost[];
}

export interface CommunityDiscourseInteractionTarget {
  source: CommunityDiscoursePostSource;
  topicId: string;
  postId: string;
  postNumber: number;
}

export interface CommunityDiscourseInteractionResponse {
  publishId: string;
  projectId: string;
  liked: boolean;
  metrics: import('./feed').FeedItemMetrics;
  target: CommunityDiscourseInteractionTarget | null;
}

export interface CreateCommunityDiscourseCommentRequest {
  scope?: CommunityDiscourseScope;
  raw: string;
  topicId?: string | null;
  replyToPostNumber?: number | null;
}

export interface CreateCommunityDiscourseCommentResponse {
  topicId: string;
  source: CommunityDiscoursePostSource;
  rawResponse: unknown;
}
