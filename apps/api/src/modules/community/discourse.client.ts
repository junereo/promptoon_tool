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

export interface DiscourseUserCreateResponse {
  success?: boolean;
  message?: string;
  errors?: unknown;
}

export interface DiscourseUploadResponse {
  id?: number;
  upload_id?: number;
  url?: string;
  short_url?: string;
}

export interface DiscourseAssetResponse {
  body: Buffer;
  contentType: string;
  cacheControl: string | null;
}

function getBaseUrl(): string {
  const missingEnv = getMissingDiscourseEnv();
  if (missingEnv.length > 0) {
    throw new HttpError(503, `Discourse integration is not configured. Missing: ${missingEnv.join(', ')}.`, {
      missingEnv
    });
  }

  return env.discourse.baseUrl!.replace(/\/+$/, '');
}

export function isDiscourseConfigured(): boolean {
  return Boolean(env.discourse.baseUrl && env.discourse.apiKey);
}

export function getMissingDiscourseEnv(): string[] {
  const missingEnv: string[] = [];
  if (!env.discourse.baseUrl) {
    missingEnv.push('DISCOURSE_BASE_URL');
  }
  if (!env.discourse.apiKey) {
    missingEnv.push('DISCOURSE_API_KEY');
  }

  return missingEnv;
}

export function getDiscourseTopicUrl(topicId: string | number): string | null {
  if (!env.discourse.baseUrl) {
    return null;
  }

  return `${env.discourse.baseUrl.replace(/\/+$/, '')}/t/${encodeURIComponent(String(topicId))}`;
}

function normalizeAssetPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('..')) {
    throw new HttpError(400, 'Invalid Discourse asset path.');
  }

  const pathname = trimmed.split('?')[0] ?? '';
  const isAllowedAssetPath = ['/letter_avatar_proxy/', '/user_avatar/', '/uploads/'].some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (!isAllowedAssetPath) {
    throw new HttpError(400, 'Unsupported Discourse asset path.');
  }

  return trimmed;
}

async function requestDiscourse<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    username?: string;
  } = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Api-Key': env.discourse.apiKey ?? '',
        'Api-Username': options.username ?? env.discourse.apiUser
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
  } catch (error) {
    throw new HttpError(502, 'Discourse request failed.', {
      reason: error instanceof Error ? error.message : 'Network request failed.'
    });
  }

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

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
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

export function getTopic(topicId: string, username?: string): Promise<unknown> {
  return requestDiscourse(`/t/${encodeURIComponent(topicId)}.json`, {
    username
  });
}

export function getUser(username: string): Promise<unknown> {
  return requestDiscourse(`/u/${encodeURIComponent(username)}.json`);
}

export async function getAsset(path: string): Promise<DiscourseAssetResponse> {
  const response = await fetch(`${getBaseUrl()}${normalizeAssetPath(path)}`, {
    headers: {
      Accept: 'image/*',
      'Api-Key': env.discourse.apiKey ?? '',
      'Api-Username': env.discourse.apiUser
    }
  });

  if (!response.ok) {
    throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, 'Discourse asset request failed.', {
      status: response.status
    });
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new HttpError(502, 'Discourse asset response is not an image.', {
      contentType
    });
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType,
    cacheControl: response.headers.get('cache-control')
  };
}

export function createUser(input: {
  username: string;
  name: string;
  email: string;
  password: string;
}): Promise<DiscourseUserCreateResponse> {
  return requestDiscourse<DiscourseUserCreateResponse>('/users.json', {
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

export async function uploadAvatar(input: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  username: string;
}): Promise<DiscourseUploadResponse> {
  const missingEnv = getMissingDiscourseEnv();
  if (missingEnv.length > 0) {
    throw new HttpError(503, `Discourse integration is not configured. Missing: ${missingEnv.join(', ')}.`, {
      missingEnv
    });
  }

  const formData = new FormData();
  const arrayBuffer = input.buffer.buffer.slice(
    input.buffer.byteOffset,
    input.buffer.byteOffset + input.buffer.byteLength
  ) as ArrayBuffer;
  formData.append('type', 'avatar');
  formData.append('synchronous', 'true');
  formData.append('file', new Blob([arrayBuffer], { type: input.contentType }), input.fileName);

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}/uploads.json`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Api-Key': env.discourse.apiKey ?? '',
        'Api-Username': input.username
      },
      body: formData
    });
  } catch (error) {
    throw new HttpError(502, 'Discourse avatar upload failed.', {
      reason: error instanceof Error ? error.message : 'Network request failed.'
    });
  }

  if (!response.ok) {
    let details: unknown = null;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new HttpError(response.status >= 400 && response.status < 500 ? response.status : 502, 'Discourse avatar upload failed.', {
      status: response.status,
      details
    });
  }

  return await response.json() as DiscourseUploadResponse;
}

export function pickUploadedAvatar(input: { uploadId: number; username: string }): Promise<unknown> {
  return requestDiscourse(`/u/${encodeURIComponent(input.username)}/preferences/avatar/pick`, {
    method: 'PUT',
    username: input.username,
    body: {
      type: 'uploaded',
      upload_id: input.uploadId
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

export function unlikePost(input: { postId: string; username: string }): Promise<unknown> {
  return requestDiscourse(`/post_actions/${encodeURIComponent(input.postId)}`, {
    method: 'DELETE',
    username: input.username,
    body: {
      post_action_type_id: 2
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
