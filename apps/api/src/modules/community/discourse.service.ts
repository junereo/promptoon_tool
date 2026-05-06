import { randomBytes } from 'node:crypto';

import { db } from '../../db';
import { env } from '../../lib/env';
import { HttpError } from '../../lib/http-error';
import * as repository from '../promptoon-core/product.repository';
import * as client from './discourse.client';

function buildDiscourseUsername(userId: string): string {
  return `promptoon_${userId.replace(/-/g, '').slice(0, 24)}`;
}

function buildFallbackEmail(userId: string): string {
  return `promptoon_${userId.replace(/-/g, '')}@users.invalid`;
}

export function getDiscourseTopicUrl(topicId: string | number): string | null {
  return client.getDiscourseTopicUrl(topicId);
}

export function isDiscourseConfigured(): boolean {
  return client.isDiscourseConfigured();
}

export async function ensureDiscourseUserForUser(userId: string): Promise<string> {
  const user = await repository.getUserCommunityIdentity(db, userId);
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  if (user.discourseUsername) {
    try {
      await client.getUser(user.discourseUsername);
      return user.discourseUsername;
    } catch (error) {
      if (!(error instanceof HttpError) || error.statusCode !== 404) {
        throw error;
      }
    }
  }

  const discourseUsername = user.discourseUsername ?? buildDiscourseUsername(user.id);
  await client.createUser({
    username: discourseUsername,
    name: user.displayName ?? user.loginId ?? discourseUsername,
    email: user.email ?? buildFallbackEmail(user.id),
    password: randomBytes(24).toString('base64url')
  });
  await repository.updateUserDiscourseUsername(db, {
    userId: user.id,
    discourseUsername
  });

  return discourseUsername;
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

export function getTopic(topicId: string): Promise<unknown> {
  return client.getTopic(topicId);
}

export async function createTopicForPublish(input: {
  publishId: string;
  title: string;
  raw: string;
  userId: string;
}): Promise<{ topicId: string; topicUrl: string | null; rawResponse: unknown }> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  const created = await client.createTopic({
    title: input.title,
    raw: input.raw,
    category: env.discourse.categoryId,
    username: discourseUsername
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

export async function bookmarkPost(input: { postId: string; userId: string }): Promise<unknown> {
  const discourseUsername = await ensureDiscourseUserForUser(input.userId);
  return client.bookmarkPost({
    postId: input.postId,
    username: discourseUsername
  });
}
