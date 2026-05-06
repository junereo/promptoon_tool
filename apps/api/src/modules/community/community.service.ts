import type {
  CommentsMetaResponse,
  CommunityComment,
  CommunityCommentListResponse,
  CommunityDiscourseCommentsResponse,
  CommunityDiscourseInteractionResponse,
  CommunityDiscoursePost,
  CommunityDiscoursePostSource,
  CommunityDiscourseScope,
  CommunityEmbedResponse,
  CommunityThreadSyncStatus,
  CreateCommunityDiscourseCommentResponse,
  DiscourseThreadSyncResponse,
  FeedItemMetrics,
  TelemetryEventPayload
} from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as projectionService from '../promptoon-core/projection.service';
import * as repository from '../promptoon-core/product.repository';
import * as discourseService from './discourse.service';
import type { DiscourseAssetResponse } from './discourse.client';

interface DiscoursePostRecord {
  id?: unknown;
  post_number?: unknown;
  reply_to_post_number?: unknown;
  username?: unknown;
  name?: unknown;
  avatar_template?: unknown;
  cooked?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  deleted_at?: unknown;
  hidden?: unknown;
  like_count?: unknown;
  reply_count?: unknown;
  actions_summary?: unknown;
}

interface DiscourseTopicRecord {
  id?: unknown;
  title?: unknown;
  post_stream?: {
    posts?: unknown[];
  };
}

interface DiscoursePostActionSummaryRecord {
  id?: unknown;
  count?: unknown;
  acted?: unknown;
}

interface DiscourseCommentTarget {
  topicId: string;
  source: CommunityDiscoursePostSource;
  projectId: string;
  publishId?: string | null;
}

interface DiscoursePublishLikeTarget {
  source: 'episode';
  topicId: string;
  postId: string;
  postNumber: number;
  likeCount: number;
  liked: boolean;
}

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toTopicRecord(value: unknown): DiscourseTopicRecord {
  const record = toRecord(value);
  const postStream = toRecord(record.post_stream);
  return {
    id: record.id,
    title: record.title,
    post_stream: {
      posts: Array.isArray(postStream.posts) ? postStream.posts : []
    }
  };
}

function toNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toStringId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function getPostActionSummary(post: DiscoursePostRecord, actionId: number): DiscoursePostActionSummaryRecord | null {
  if (!Array.isArray(post.actions_summary)) {
    return null;
  }

  return (
    post.actions_summary
      .map((value) => toRecord(value) as DiscoursePostActionSummaryRecord)
      .find((summary) => toNumber(summary.id) === actionId) ?? null
  );
}

function getDiscourseLikeCount(post: DiscoursePostRecord): number {
  const likeAction = getPostActionSummary(post, 2);
  return toNumber(likeAction?.count) ?? toNumber(post.like_count) ?? 0;
}

function getDiscourseLikedByCurrentUser(post: DiscoursePostRecord): boolean {
  return getPostActionSummary(post, 2)?.acted === true;
}

function getTopicFirstPost(topic: unknown): DiscoursePostRecord | null {
  const topicRecord = toTopicRecord(topic);
  const firstPost = (topicRecord.post_stream?.posts ?? [])
    .map((post) => toRecord(post) as DiscoursePostRecord)
    .find((post) => toNumber(post.post_number) === 1);

  if (!firstPost || firstPost.deleted_at || firstPost.hidden === true) {
    return null;
  }

  return firstPost;
}

function getTopicLabel(input: {
  source: CommunityDiscoursePostSource;
  projectTitle: string;
  episodeTitle?: string | null;
}): string {
  if (input.source === 'project') {
    return `${input.projectTitle} 전체`;
  }
  return `${input.projectTitle} ${input.episodeTitle ?? '에피소드'}`;
}

function getDiscourseAvatarUrl(post: DiscoursePostRecord): string | null {
  const template = toStringValue(post.avatar_template);
  return discourseService.resolveDiscourseUrl(template?.replace('{size}', '96'));
}

function normalizeDiscourseTopicPosts(
  topic: unknown,
  context: repository.ProductDiscourseTopicContext,
  projectTitle: string
): CommunityDiscoursePost[] {
  const topicRecord = toTopicRecord(topic);
  const topicId = context.discourseTopicId;
  const label = getTopicLabel({
    source: context.source,
    projectTitle,
    episodeTitle: context.episodeTitle
  });

  return (topicRecord.post_stream?.posts ?? [])
    .map((post): CommunityDiscoursePost | null => {
      const record = toRecord(post) as DiscoursePostRecord;
      const postNumber = toNumber(record.post_number);
      if (!postNumber || postNumber === 1) {
        return null;
      }
      if (record.deleted_at || record.hidden === true) {
        return null;
      }

      return {
        id: String(record.id ?? `${topicId}:${postNumber}`),
        topicId,
        postNumber,
        replyToPostNumber: toNumber(record.reply_to_post_number),
        source: context.source,
        label,
        publishId: context.publishId,
        episodeId: context.episodeId,
        episodeTitle: context.episodeTitle,
        username: toStringValue(record.username) ?? 'unknown',
        displayName: toStringValue(record.name),
        avatarUrl: getDiscourseAvatarUrl(record),
        cooked: toStringValue(record.cooked) ?? '',
        createdAt: toStringValue(record.created_at) ?? new Date().toISOString(),
        updatedAt: toStringValue(record.updated_at),
        likeCount: getDiscourseLikeCount(record),
        replyCount: toNumber(record.reply_count) ?? 0
      };
    })
    .filter((post): post is CommunityDiscoursePost => Boolean(post));
}

function getLatestPostCreatedAt(posts: CommunityDiscoursePost[]): string | null {
  return posts.reduce<string | null>((latest, post) => {
    if (!latest) {
      return post.createdAt;
    }
    return new Date(post.createdAt).getTime() > new Date(latest).getTime() ? post.createdAt : latest;
  }, null);
}

function sortPostsLatestFirst(posts: CommunityDiscoursePost[]): CommunityDiscoursePost[] {
  return [...posts].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

async function ensurePublishModeratableByUser(publishId: string, userId: string): Promise<void> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const ownerId = await repository.getProjectOwnerId(db, publish.projectId);
  const role = await repository.getProjectMemberRole(db, {
    projectId: publish.projectId,
    userId
  });

  if (ownerId !== userId && role !== 'owner' && role !== 'producer' && role !== 'writer') {
    throw new HttpError(403, 'You do not have access to moderate this discussion.');
  }
}

async function ensureCommentWritableByUser(comment: CommunityComment, userId: string): Promise<void> {
  if (comment.userId === userId && comment.status !== 'deleted') {
    return;
  }

  await ensurePublishModeratableByUser(comment.publishId, userId);
}

async function refreshCommentProjections(publishId: string): Promise<void> {
  await withTransaction(async (client) => {
    const context = await repository.refreshCommunityCommentMetrics(client, publishId);
    await projectionService.rebuildChannelProjectionForChannel(client, context?.channel_id);
  });
}

export async function ensureDiscussionForEpisode(episodeId: string, userId: string): Promise<void> {
  const projectId = await repository.getEpisodeProjectId(db, episodeId);
  if (!projectId) {
    throw new HttpError(404, 'Episode not found.');
  }
  const ownerId = await repository.getProjectOwnerId(db, projectId);
  const role = await repository.getProjectMemberRole(db, {
    projectId,
    userId
  });
  if (ownerId !== userId && !role) {
    throw new HttpError(403, 'You do not have access to this project.');
  }

  await repository.ensureEpisodeDiscussion(db, { episodeId });
}

export function getCommentsMeta(publishId: string): Promise<CommentsMetaResponse> {
  return projectionService.getCommentsMeta(publishId);
}

export async function getCommunityEmbed(publishId: string): Promise<CommunityEmbedResponse> {
  const [publish, meta, threadSync] = await Promise.all([
    projectionService.getPublishedEpisode(publishId),
    projectionService.getCommentsMeta(publishId),
    repository.getDiscourseThreadSync(db, publishId)
  ]);

  const discourseTopicId = threadSync?.status === 'synced' ? threadSync.discourseTopicId : null;
  const discourseUrl = discourseTopicId ? discourseService.getDiscourseTopicUrl(discourseTopicId) : null;

  return {
    ...meta,
    provider: discourseTopicId ? 'discourse' : 'promptoon',
    title: `${publish.manifest.episode.title} 댓글`,
    ...(discourseTopicId
      ? {
          discourseTopicId,
          embedUrl: discourseUrl ?? meta.embedUrl ?? meta.discussionUrl ?? null,
          discussionUrl: discourseUrl ?? meta.discussionUrl ?? null
        }
      : {})
  };
}

export async function listComments(publishId: string): Promise<CommunityCommentListResponse> {
  assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');

  return {
    publishId,
    comments: await repository.listCommunityComments(db, publishId)
  };
}

export async function createComment(publishId: string, body: string, userId: string): Promise<CommunityComment> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  await repository.ensureEpisodeDiscussion(db, {
    episodeId: publish.episodeId,
    publishId: publish.id
  });

  const comment = await repository.createCommunityComment(db, {
    publishId,
    userId,
    body
  });
  await refreshCommentProjections(publishId);
  await repository.insertTelemetryEvent(db, {
    eventName: 'community_comment_created',
    userId,
    projectId: publish.projectId,
    episodeId: publish.episodeId,
    publishId,
    payload: {
      commentId: comment.id
    }
  });

  return comment;
}

export async function updateComment(commentId: string, body: string, userId: string): Promise<CommunityComment> {
  const existing = assertExists(await repository.getCommunityCommentById(db, commentId), 'Comment not found.');
  await ensureCommentWritableByUser(existing, userId);
  const updated = assertExists(
    await repository.updateCommunityCommentBody(db, {
      commentId,
      body
    }),
    'Comment not found.'
  );
  await refreshCommentProjections(updated.publishId);
  return updated;
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const existing = assertExists(await repository.getCommunityCommentById(db, commentId), 'Comment not found.');
  await ensureCommentWritableByUser(existing, userId);
  const deleted = assertExists(
    await repository.moderateCommunityComment(db, {
      commentId,
      status: 'deleted',
      reason: 'deleted_by_user'
    }),
    'Comment not found.'
  );
  await refreshCommentProjections(deleted.publishId);
}

export async function moderateComment(
  commentId: string,
  input: {
    status: CommunityComment['status'];
    reason?: string | null;
  },
  userId: string
): Promise<CommunityComment> {
  const existing = assertExists(await repository.getCommunityCommentById(db, commentId), 'Comment not found.');
  await ensurePublishModeratableByUser(existing.publishId, userId);
  const moderated = assertExists(
    await repository.moderateCommunityComment(db, {
      commentId,
      status: input.status,
      reason: input.reason
    }),
    'Comment not found.'
  );
  await refreshCommentProjections(moderated.publishId);
  return moderated;
}

export async function syncDiscourseThread(
  publishId: string,
  input: {
    discourseTopicId?: string | null;
    status: CommunityThreadSyncStatus;
    createTopic?: boolean;
    payload?: Record<string, unknown>;
  },
  userId: string
): Promise<DiscourseThreadSyncResponse> {
  await ensurePublishModeratableByUser(publishId, userId);
  if (input.createTopic && !input.discourseTopicId) {
    return createDiscourseThreadForPublish(publishId, userId);
  }

  const response = await repository.upsertDiscourseThreadSync(db, {
    publishId,
    discourseTopicId: input.discourseTopicId,
    status: input.status,
    payload: input.payload
  });
  await repository.insertTelemetryEvent(db, {
    eventName: 'community_discourse_sync',
    userId,
    publishId,
    payload: {
      status: response.status,
      discourseTopicId: response.discourseTopicId
    }
  });
  return response;
}

async function ensureDiscourseThreadForPublish(
  publish: import('@promptoon/shared').Publish,
  userId: string
): Promise<DiscourseThreadSyncResponse> {
  const existing = await repository.getDiscourseThreadSync(db, publish.id);
  if (existing?.status === 'synced' && existing.discourseTopicId) {
    return existing;
  }

  const title = `${publish.manifest.project.title} - ${publish.manifest.episode.title}`;
  const topic = await discourseService.createTopicForPublish({
    publishId: publish.id,
    title,
    userId,
    raw: [
      `Promptoon episode discussion for **${publish.manifest.episode.title}**.`,
      '',
      `Viewer: /v/${publish.id}`,
      `Community: /community/publishes/${publish.id}`
    ].join('\n')
  });

  const response = await repository.upsertDiscourseThreadSync(db, {
    publishId: publish.id,
    discourseTopicId: topic.topicId,
    status: 'synced',
    payload: {
      topicUrl: topic.topicUrl,
      rawResponse: topic.rawResponse
    }
  });

  await repository.insertTelemetryEvent(db, {
    eventName: 'community_discourse_topic_created',
    userId,
    projectId: publish.projectId,
    episodeId: publish.episodeId,
    publishId: publish.id,
    payload: {
      discourseTopicId: topic.topicId,
      topicUrl: topic.topicUrl
    }
  });

  return response;
}

async function ensureProjectDiscourseThreadForPublish(
  publish: import('@promptoon/shared').Publish,
  userId: string
): Promise<DiscourseCommentTarget> {
  const existing = await repository.getProjectDiscussion(db, publish.projectId);
  if (existing?.status === 'synced' && existing.discourseTopicId) {
    return {
      topicId: existing.discourseTopicId,
      source: 'project',
      projectId: publish.projectId
    };
  }

  const topic = await discourseService.createTopic({
    title: `${publish.manifest.project.title} 전체 댓글`,
    userId,
    raw: [
      `Promptoon project discussion for **${publish.manifest.project.title}**.`,
      '',
      `Project: ${publish.projectId}`,
      `Community: /community/projects/${publish.projectId}`
    ].join('\n')
  });

  await repository.upsertProjectDiscussionSync(db, {
    projectId: publish.projectId,
    discourseTopicId: topic.topicId,
    status: 'synced',
    discussionUrl: topic.topicUrl,
    payload: {
      topicUrl: topic.topicUrl,
      rawResponse: topic.rawResponse
    }
  });

  await repository.insertTelemetryEvent(db, {
    eventName: 'community_discourse_project_topic_created',
    userId,
    projectId: publish.projectId,
    payload: {
      discourseTopicId: topic.topicId,
      topicUrl: topic.topicUrl
    }
  });

  return {
    topicId: topic.topicId,
    source: 'project',
    projectId: publish.projectId
  };
}

export async function createDiscourseThreadForPublish(publishId: string, userId: string): Promise<DiscourseThreadSyncResponse> {
  await ensurePublishModeratableByUser(publishId, userId);
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  return ensureDiscourseThreadForPublish(publish, userId);
}

export async function getDiscourseTopic(topicId: string): Promise<unknown> {
  return discourseService.getTopic(topicId);
}

export function getDiscourseAsset(path: string): Promise<DiscourseAssetResponse> {
  return discourseService.getAsset(path);
}

export async function getDiscourseCategories(): Promise<unknown> {
  return discourseService.getCategories();
}

export async function getDiscourseLatestTopics(): Promise<unknown> {
  return discourseService.getLatestTopics();
}

export async function getDiscourseTopTopics(): Promise<unknown> {
  return discourseService.getTopTopics();
}

async function getDiscourseTopicPosts(
  context: repository.ProductDiscourseTopicContext,
  projectTitle: string
): Promise<CommunityDiscoursePost[]> {
  const topic = await discourseService.getTopic(context.discourseTopicId);
  return normalizeDiscourseTopicPosts(topic, context, projectTitle);
}

async function refreshDiscourseTargetMetrics(target: DiscourseCommentTarget): Promise<void> {
  const topicContext: repository.ProductDiscourseTopicContext = {
    projectId: target.projectId,
    publishId: target.publishId ?? null,
    episodeId: null,
    episodeTitle: null,
    discourseTopicId: target.topicId,
    source: target.source
  };
  const posts = await getDiscourseTopicPosts(topicContext, '');
  const latestCommentAt = getLatestPostCreatedAt(posts);

  if (target.source === 'project') {
    await repository.updateProjectDiscussionMetrics(db, {
      projectId: target.projectId,
      commentCount: posts.length,
      latestCommentAt
    });
    return;
  }

  if (!target.publishId) {
    return;
  }

  await withTransaction(async (client) => {
    const context = await repository.updateEpisodeDiscourseMetrics(client, {
      publishId: target.publishId ?? '',
      discourseTopicId: target.topicId,
      commentCount: posts.length,
      latestCommentAt,
      discussionUrl: discourseService.getDiscourseTopicUrl(target.topicId)
    });
    await projectionService.rebuildChannelProjectionForChannel(client, context?.channel_id);
  });
}

async function getProjectCommentTargetForPublish(
  publish: import('@promptoon/shared').Publish,
  input: {
    topicId?: string | null;
  },
  userId: string
): Promise<DiscourseCommentTarget> {
  if (!input.topicId) {
    return ensureProjectDiscourseThreadForPublish(publish, userId);
  }

  const context = await repository.getDiscourseTopicContextForProject(db, {
    projectId: publish.projectId,
    topicId: input.topicId
  });

  if (!context) {
    throw new HttpError(403, 'Discourse topic does not belong to this project.');
  }

  return {
    topicId: context.discourseTopicId,
    source: context.source,
    projectId: context.projectId,
    publishId: context.publishId
  };
}

async function getEpisodeCommentTargetForPublish(
  publish: import('@promptoon/shared').Publish,
  input: {
    topicId?: string | null;
  },
  userId: string
): Promise<DiscourseCommentTarget> {
  const threadSync = await ensureDiscourseThreadForPublish(publish, userId);
  if (!threadSync.discourseTopicId) {
    throw new HttpError(409, 'Discourse thread is not synced.');
  }
  if (input.topicId && input.topicId !== threadSync.discourseTopicId) {
    throw new HttpError(403, 'Discourse topic does not belong to this episode.');
  }

  return {
    topicId: threadSync.discourseTopicId,
    source: 'episode',
    projectId: publish.projectId,
    publishId: publish.id
  };
}

export async function listDiscourseComments(
  publishId: string,
  scope: CommunityDiscourseScope
): Promise<CommunityDiscourseCommentsResponse> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const project = assertExists(await repository.getProjectById(db, publish.projectId), 'Project not found.');

  if (scope === 'episode') {
    const threadSync = await repository.getDiscourseThreadSync(db, publishId);
    if (threadSync?.status !== 'synced' || !threadSync.discourseTopicId) {
      return {
        publishId,
        projectId: publish.projectId,
        scope,
        title: `${publish.manifest.episode.title} 댓글`,
        commentCount: 0,
        topics: [],
        posts: []
      };
    }

    const context: repository.ProductDiscourseTopicContext = {
      projectId: publish.projectId,
      publishId,
      episodeId: publish.episodeId,
      episodeTitle: publish.manifest.episode.title,
      discourseTopicId: threadSync.discourseTopicId,
      source: 'episode'
    };
    const posts = await getDiscourseTopicPosts(context, project.title);
    const label = getTopicLabel({
      source: 'episode',
      projectTitle: project.title,
      episodeTitle: publish.manifest.episode.title
    });

    return {
      publishId,
      projectId: publish.projectId,
      scope,
      title: `${publish.manifest.episode.title} 댓글`,
      commentCount: posts.length,
      topics: [
        {
          topicId: threadSync.discourseTopicId,
          source: 'episode',
          title: `${project.title} - ${publish.manifest.episode.title}`,
          label,
          publishId,
          episodeId: publish.episodeId,
          episodeTitle: publish.manifest.episode.title
        }
      ],
      posts: sortPostsLatestFirst(posts)
    };
  }

  const contexts = await repository.listSyncedDiscourseTopicContextsByProjectId(db, publish.projectId);
  const postGroups = await Promise.all(contexts.map((context) => getDiscourseTopicPosts(context, project.title)));
  const posts = sortPostsLatestFirst(postGroups.flat());

  return {
    publishId,
    projectId: publish.projectId,
    scope,
    title: `${project.title} 전체 댓글`,
    commentCount: posts.length,
    topics: contexts.map((context) => ({
      topicId: context.discourseTopicId,
      source: context.source,
      title: getTopicLabel({
        source: context.source,
        projectTitle: project.title,
        episodeTitle: context.episodeTitle
      }),
      label: getTopicLabel({
        source: context.source,
        projectTitle: project.title,
        episodeTitle: context.episodeTitle
      }),
      publishId: context.publishId,
      episodeId: context.episodeId,
      episodeTitle: context.episodeTitle
    })),
    posts
  };
}

async function getDiscoursePublishLikeTarget(
  publish: import('@promptoon/shared').Publish,
  input: {
    createIfMissing: boolean;
    userId?: string | null;
  }
): Promise<DiscoursePublishLikeTarget | null> {
  const threadSync = input.createIfMissing
    ? await ensureDiscourseThreadForPublish(publish, assertExists(input.userId ?? null, 'Authentication is required.'))
    : await repository.getDiscourseThreadSync(db, publish.id);

  if (threadSync?.status !== 'synced' || !threadSync.discourseTopicId) {
    return null;
  }

  const topic =
    input.userId && !input.createIfMissing
      ? await discourseService.getTopicForExistingUser(threadSync.discourseTopicId, input.userId)
      : await discourseService.getTopic(threadSync.discourseTopicId, input.userId ?? undefined);
  const firstPost = getTopicFirstPost(topic);
  const postId = toStringId(firstPost?.id);
  const postNumber = toNumber(firstPost?.post_number);
  if (!firstPost || !postId || !postNumber) {
    return null;
  }

  return {
    source: 'episode',
    topicId: threadSync.discourseTopicId,
    postId,
    postNumber,
    likeCount: getDiscourseLikeCount(firstPost),
    liked: Boolean(input.userId && getDiscourseLikedByCurrentUser(firstPost))
  };
}

export async function getDiscourseInteraction(
  publishId: string,
  userId?: string | null
): Promise<CommunityDiscourseInteractionResponse> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const [comments, likeTarget] = await Promise.all([
    listDiscourseComments(publishId, 'project'),
    getDiscoursePublishLikeTarget(publish, {
      createIfMissing: false,
      userId
    })
  ]);
  const metrics: FeedItemMetrics = {
    views: 0,
    likes: likeTarget?.likeCount ?? 0,
    comments: comments.commentCount,
    shares: 0
  };

  return {
    publishId,
    projectId: publish.projectId,
    liked: likeTarget?.liked ?? false,
    metrics,
    target: likeTarget
      ? {
          source: likeTarget.source,
          topicId: likeTarget.topicId,
          postId: likeTarget.postId,
          postNumber: likeTarget.postNumber
        }
      : null
  };
}

export async function likeDiscoursePublish(
  publishId: string,
  userId: string
): Promise<CommunityDiscourseInteractionResponse> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const target = assertExists(
    await getDiscoursePublishLikeTarget(publish, {
      createIfMissing: true,
      userId
    }),
    'Discourse topic post not found.'
  );

  if (!target.liked) {
    await discourseService.likePost({
      postId: target.postId,
      userId
    });
  }

  await repository.insertTelemetryEvent(db, {
    eventName: 'community_discourse_like',
    userId,
    projectId: publish.projectId,
    episodeId: publish.episodeId,
    publishId,
    payload: {
      action: 'like',
      topicId: target.topicId,
      postId: target.postId
    }
  });

  return getDiscourseInteraction(publishId, userId);
}

export async function unlikeDiscoursePublish(
  publishId: string,
  userId: string
): Promise<CommunityDiscourseInteractionResponse> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const target = await getDiscoursePublishLikeTarget(publish, {
    createIfMissing: false,
    userId
  });

  if (target?.liked) {
    await discourseService.unlikePost({
      postId: target.postId,
      userId
    });
  }

  await repository.insertTelemetryEvent(db, {
    eventName: 'community_discourse_like',
    userId,
    projectId: publish.projectId,
    episodeId: publish.episodeId,
    publishId,
    payload: {
      action: 'unlike',
      topicId: target?.topicId ?? null,
      postId: target?.postId ?? null
    }
  });

  return getDiscourseInteraction(publishId, userId);
}

export async function createDiscourseComment(
  publishId: string,
  input: {
    scope?: CommunityDiscourseScope;
    raw: string;
    topicId?: string | null;
    replyToPostNumber?: number | null;
  },
  userId: string
): Promise<CreateCommunityDiscourseCommentResponse> {
  const publish = assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const scope = input.scope ?? 'episode';
  const target =
    scope === 'project'
      ? await getProjectCommentTargetForPublish(publish, input, userId)
      : await getEpisodeCommentTargetForPublish(publish, input, userId);

  const rawResponse = await discourseService.createComment({
    topicId: target.topicId,
    raw: input.raw,
    userId,
    replyToPostNumber: input.replyToPostNumber
  });

  await refreshDiscourseTargetMetrics(target);

  return {
    topicId: target.topicId,
    source: target.source,
    rawResponse
  };
}

export function updateDiscoursePost(postId: string, raw: string, userId: string): Promise<unknown> {
  return discourseService.updatePost({ postId, raw, userId });
}

export function deleteDiscoursePost(postId: string, userId: string): Promise<unknown> {
  return discourseService.deletePost({ postId, userId });
}

export function likeDiscoursePost(postId: string, userId: string): Promise<unknown> {
  return discourseService.likePost({ postId, userId });
}

export function bookmarkDiscoursePost(postId: string, userId: string): Promise<unknown> {
  return discourseService.bookmarkPost({ postId, userId });
}

export async function trackTelemetryEvent(payload: TelemetryEventPayload): Promise<void> {
  await repository.insertTelemetryEvent(db, payload);
}
