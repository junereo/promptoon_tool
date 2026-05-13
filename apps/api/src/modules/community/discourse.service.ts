import { createHash, randomBytes } from 'node:crypto';

import { db } from '../../db';
import { env } from '../../lib/env';
import { HttpError } from '../../lib/http-error';
import * as repository from '../promptoon-core/product.repository';
import * as client from './discourse.client';

const DISCOURSE_USERNAME_MAX_LENGTH = 20;

function buildDiscourseUsername(userId: string): string {
  const hash = createHash('sha256').update(userId).digest('hex');
  return `pt_${hash.slice(0, DISCOURSE_USERNAME_MAX_LENGTH - 3)}`;
}

function buildFallbackEmail(userId: string): string {
  return `promptoon_${userId.replace(/-/g, '')}@users.invalid`;
}

function isUsableDiscourseUsername(username: string | null | undefined): username is string {
  return Boolean(
    username &&
      username.length <= DISCOURSE_USERNAME_MAX_LENGTH &&
      /^[a-z0-9_]+$/i.test(username)
  );
}

function getDiscourseUploadId(response: client.DiscourseUploadResponse): number {
  const uploadId = response.id ?? response.upload_id;
  if (typeof uploadId !== 'number' || !Number.isFinite(uploadId)) {
    throw new HttpError(502, 'Discourse avatar upload response did not include an upload id.', response);
  }

  return uploadId;
}

export function getDiscourseTopicUrl(topicId: string | number): string | null {
  return client.getDiscourseTopicUrl(topicId);
}

function getDiscourseAssetProxyUrl(path: string): string {
  return `/api/community/discourse/assets?path=${encodeURIComponent(path)}`;
}

export function resolveDiscourseUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith('//')) {
    return `https:${value}`;
  }
  if (/^https?:\/\//i.test(value)) {
    if (!env.discourse.baseUrl) {
      return value;
    }

    const discourseBase = new URL(env.discourse.baseUrl);
    const target = new URL(value);
    if (target.origin === discourseBase.origin) {
      return getDiscourseAssetProxyUrl(`${target.pathname}${target.search}`);
    }

    return value;
  }
  if (env.discourse.baseUrl && value.startsWith('/')) {
    return getDiscourseAssetProxyUrl(value);
  }
  return value;
}

export function isDiscourseConfigured(): boolean {
  return client.isDiscourseConfigured();
}

export async function ensureDiscourseUserForUser(userId: string): Promise<string> {
  const user = await repository.getUserCommunityIdentity(db, userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  if (isUsableDiscourseUsername(user.discourseUsername)) {
    try {
      await client.getUser(user.discourseUsername);
      return user.discourseUsername;
    } catch (error) {
      if (!(error instanceof HttpError) || error.statusCode !== 404) {
        throw error;
      }
    }
  }

  const discourseUsername = buildDiscourseUsername(user.id);
  try {
    const created = await client.createUser({
      username: discourseUsername,
      name: user.displayName ?? user.loginId ?? discourseUsername,
      email: user.email ?? buildFallbackEmail(user.id),
      password: randomBytes(24).toString('base64url')
    });
    if (created.success === false) {
      throw new HttpError(422, 'Discourse user creation failed.', created);
    }
  } catch (error) {
    if (!(error instanceof HttpError) || (error.statusCode !== 400 && error.statusCode !== 422)) {
      throw error;
    }
    await client.getUser(discourseUsername);
  }
  await repository.updateUserDiscourseUsername(db, {
    userId: user.id,
    discourseUsername
  });

  return discourseUsername;
}

export async function syncUserAvatar(input: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  userId: string;
}): Promise<{ status: 'skipped' | 'synced'; username?: string }> {
  if (!isDiscourseConfigured()) {
    return { status: 'skipped' };
  }

  const username = await ensureDiscourseUserForUser(input.userId);
  const upload = await client.uploadAvatar({
    buffer: input.buffer,
    contentType: input.contentType,
    fileName: input.fileName,
    username
  });
  await client.pickUploadedAvatar({
    uploadId: getDiscourseUploadId(upload),
    username
  });

  return {
    status: 'synced',
    username
  };
}

export function getCategories(): Promise<unknown> {
  return client.getCategories();
}

export function getLatestTopics(): Promise<unknown> {
  return client.getLatestTopics();
}

export function getTopTopics(): Promise<unknown> {
  return client.getTopTopics();
}

export async function getTopic(topicId: string, userId?: string): Promise<unknown> {
  const discourseUsername = userId ? await ensureDiscourseUserForUser(userId) : undefined;
  return client.getTopic(topicId, discourseUsername);
}

export async function getTopicForExistingUser(topicId: string, userId: string): Promise<unknown> {
  const user = await repository.getUserCommunityIdentity(db, userId);
  if (!isUsableDiscourseUsername(user?.discourseUsername)) {
    return client.getTopic(topicId);
  }

  try {
    return await client.getTopic(topicId, user.discourseUsername);
  } catch (error) {
    if (error instanceof HttpError && (error.statusCode === 403 || error.statusCode === 404)) {
      return client.getTopic(topicId);
    }
    throw error;
  }
}

export function getAsset(path: string): Promise<client.DiscourseAssetResponse> {
  return client.getAsset(path);
}

export async function createTopic(input: {
  title: string;
  raw: string;
  userId: string;
}): Promise<{ topicId: string; topicUrl: string | null; rawResponse: unknown }> {
  const created = await client.createTopic({
    title: input.title,
    raw: input.raw,
    category: env.discourse.categoryId,
    username: env.discourse.apiUser
  });
  const topicId = String(created.topic_id ?? created.id ?? '');
  if (!topicId) {
    throw new HttpError(502, 'Discourse topic response did not include a topic id.');
  }

  return {
    topicId,
    topicUrl: client.getDiscourseTopicUrl(topicId),
    rawResponse: created
  };
}

export async function createTopicForPublish(input: {
  publishId: string;
  title: string;
  raw: string;
  userId: string;
}): Promise<{ topicId: string; topicUrl: string | null; rawResponse: unknown }> {
  return createTopic({
    title: input.title,
    raw: input.raw,
    userId: input.userId
  });
}

export async function createComment(input: {
  topicId: string;
  raw: string;
  userId: string;
  replyToPostNumber?: number | null;
}): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.createPost({
    topicId: input.topicId,
    raw: input.raw,
    username: discourseUsername,
    replyToPostNumber: input.replyToPostNumber
  });
}

export async function updatePost(input: { postId: string; raw: string; userId: string }): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.updatePost({
    postId: input.postId,
    raw: input.raw,
    username: discourseUsername
  });
}

export async function deletePost(input: { postId: string; userId: string }): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.deletePost({
    postId: input.postId,
    username: discourseUsername
  });
}

export async function likePost(input: { postId: string; userId: string }): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.likePost({
    postId: input.postId,
    username: discourseUsername
  });
}

export async function unlikePost(input: { postId: string; userId: string }): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.unlikePost({
    postId: input.postId,
    username: discourseUsername
  });
}

export async function bookmarkPost(input: { postId: string; userId: string }): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.bookmarkPost({
    postId: input.postId,
    username: discourseUsername
  });
}
