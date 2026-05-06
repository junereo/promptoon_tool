import type {
  CommentsMetaResponse,
  CommunityComment,
  CommunityCommentListResponse,
  CommunityEmbedResponse,
  CommunityThreadSyncStatus,
  DiscourseThreadSyncResponse,
  TelemetryEventPayload
} from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as projectionService from '../promptoon-core/projection.service';
import * as repository from '../promptoon-core/product.repository';
import * as discourseService from './discourse.service';

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
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

export async function createDiscourseThreadForPublish(publishId: string, userId: string): Promise<DiscourseThreadSyncResponse> {
  await ensurePublishModeratableByUser(publishId, userId);
  const publish = await projectionService.getPublishedEpisode(publishId);
  const title = `${publish.manifest.project.title} - ${publish.manifest.episode.title}`;
  const topic = await discourseService.createTopicForPublish({
    publishId,
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
    publishId,
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
    publishId,
    payload: {
      discourseTopicId: topic.topicId,
      topicUrl: topic.topicUrl
    }
  });

  return response;
}

export async function getDiscourseTopic(topicId: string): Promise<unknown> {
  return discourseService.getTopic(topicId);
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

export async function createDiscourseComment(
  publishId: string,
  input: {
    raw: string;
    replyToPostNumber?: number | null;
  },
  userId: string
): Promise<unknown> {
  assertExists(await repository.getPublishById(db, publishId), 'Published episode not found.');
  const threadSync = assertExists(await repository.getDiscourseThreadSync(db, publishId), 'Discourse thread is not synced.');
  if (threadSync.status !== 'synced' || !threadSync.discourseTopicId) {
    throw new HttpError(409, 'Discourse thread is not synced.');
  }

  return discourseService.createComment({
    topicId: threadSync.discourseTopicId,
    raw: input.raw,
    userId,
    replyToPostNumber: input.replyToPostNumber
  });
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
