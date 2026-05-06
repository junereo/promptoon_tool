import { env } from '../../lib/env';
import { HttpError } from '../../lib/http-error';

export interface DiscourseTopicCreateResponse {
  id?: number;
  topic_id?: number;
  topic_slug?: string;
  post_number?: number;
}

export interface DiscoursePostResponse {
  id?: number;
  topic_id?: number;
  post_number?: number;
}

function getBaseUrl(): string {
  if (!env.discourse.baseUrl || !env.discourse.apiKey) {
    throw new HttpError(503, 'Discourse integration is not configured.');
  }

  return env.discourse.baseUrl.replace(/\/+$/, '');
}

export function isDiscourseConfigured(): boolean {
  return Boolean(env.discourse.baseUrl && env.discourse.apiKey);
}

export function getDiscourseTopicUrl(topicId: string | number): string | null {
  if (!env.discourse.baseUrl) {
    return null;
  }

  return `${env.discourse.baseUrl.replace(/\/+$/, '')}/t/${encodeURIComponent(String(topicId))}`;
}

async function requestDiscourse<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    username?: string;
  } = {}
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Api-Key': env.discourse.apiKey ?? '',
      'Api-Username': options.username ?? env.discourse.apiUser
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });

  if (!response.ok) {
    let details: unknown = null;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, 'Discourse request failed.', {
      status: response.status,
      details
    });
  }

  return response.json() as Promise<T>;
}

export function getCategories(): Promise<unknown> {
  return requestDiscourse('/categories.json');
}

export function getLatestTopics(): Promise<unknown> {
  return requestDiscourse('/latest.json');
}

export function getTopTopics(): Promise<unknown> {
  return requestDiscourse('/top.json');
}

export function getTopic(topicId: string): Promise<unknown> {
  return requestDiscourse(`/t/${encodeURIComponent(topicId)}.json`);
}

export function getUser(username: string): Promise<unknown> {
  return requestDiscourse(`/u/${encodeURIComponent(username)}.json`);
}

export function createUser(input: {
  username: string;
  name: string;
  email: string;
  password: string;
}): Promise<unknown> {
  return requestDiscourse('/users.json', {
    method: 'POST',
    username: env.discourse.apiUser,
    body: {
      username: input.username,
      name: input.name,
      email: input.email,
      password: input.password,
      active: true,
      approved: true
    }
  });
}

export function createTopic(input: {
  title: string;
  raw: string;
  category?: string | number | null;
  username: string;
}): Promise<DiscourseTopicCreateResponse> {
  return requestDiscourse('/posts.json', {
    method: 'POST',
    username: input.username,
    body: {
      title: input.title,
      raw: input.raw,
      ...(input.category ? { category: input.category } : {})
    }
  });
}

export function createPost(input: {
  topicId: string;
  raw: string;
  username: string;
  replyToPostNumber?: number | null;
}): Promise<DiscoursePostResponse> {
  return requestDiscourse('/posts.json', {
    method: 'POST',
    username: input.username,
    body: {
      topic_id: input.topicId,
      raw: input.raw,
      ...(input.replyToPostNumber ? { reply_to_post_number: input.replyToPostNumber } : {})
    }
  });
}

export function updatePost(input: {
  postId: string;
  raw: string;
  username: string;
}): Promise<unknown> {
  return requestDiscourse(`/posts/${encodeURIComponent(input.postId)}.json`, {
    method: 'PUT',
    username: input.username,
    body: {
      post: {
        raw: input.raw,
        edit_reason: 'Promptoon community edit'
      }
    }
  });
}

export function deletePost(input: { postId: string; username: string }): Promise<unknown> {
  return requestDiscourse(`/posts/${encodeURIComponent(input.postId)}.json`, {
    method: 'DELETE',
    username: input.username
  });
}

export function likePost(input: { postId: string; username: string }): Promise<unknown> {
  return requestDiscourse('/post_actions.json', {
    method: 'POST',
    username: input.username,
    body: {
      id: input.postId,
      post_action_type_id: 2,
      flag_topic: false
    }
  });
}

export function bookmarkPost(input: { postId: string; username: string }): Promise<unknown> {
  return requestDiscourse('/post_actions.json', {
    method: 'POST',
    username: input.username,
    body: {
      id: input.postId,
      post_action_type_id: 1,
      flag_topic: false
    }
  });
}
