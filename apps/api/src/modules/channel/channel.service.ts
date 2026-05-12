import type { ChannelHome, ChannelProfileUpdateResponse, ChannelSubscriptionStateResponse, UpdateChannelProfileRequest } from '@promptoon/shared';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../../lib/workspace-paths';
import * as discourseService from '../community/discourse.service';
import * as projectionService from '../promptoon-core/projection.service';
import * as repository from '../promptoon-core/product.repository';

interface ChannelProfileImageUploadResponse {
  channel: ChannelHome['profile'];
  home: ChannelHome;
}

interface UploadFileWrite {
  fileName: string;
  buffer: Buffer;
}

interface ChannelImageUploadWriteResult {
  publicUrl: string;
  webpBuffer: Buffer;
}

const CHANNEL_DISPLAY_NAME_MAX_LENGTH = 80;
const CHANNEL_BIO_MAX_LENGTH = 280;

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

export function getChannelHome(channelSlug: string, userId?: string): Promise<ChannelHome> {
  return projectionService.getChannelHome(channelSlug, userId);
}

export async function getMyChannelHome(userId: string): Promise<ChannelHome> {
  const channel = await withTransaction(async (client) => {
    const defaultChannel = await repository.ensureDefaultChannelForOwner(client, userId);
    await projectionService.rebuildChannelProjectionForChannel(client, defaultChannel.id);
    return defaultChannel;
  });

  return projectionService.getChannelHome(channel.slug, userId);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function getDatedUploadSegments(now: Date): [string, string, string] {
  return [String(now.getFullYear()), padDatePart(now.getMonth() + 1), padDatePart(now.getDate())];
}

function getUploadsDirectory(): string {
  return resolveFromWorkspaceRoot('.data/uploads');
}

function getLegacyUploadsDirectory(): string {
  return resolveFromApiRoot('.data/uploads');
}

function isWritablePathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'EROFS'].includes(String(error.code));
}

async function writeUploadFiles(relativeDirectory: string, files: UploadFileWrite[]): Promise<void> {
  const directoryCandidates = [path.join(getUploadsDirectory(), relativeDirectory), path.join(getLegacyUploadsDirectory(), relativeDirectory)];
  let lastError: unknown = null;

  for (const uploadsDirectory of directoryCandidates) {
    try {
      await mkdir(uploadsDirectory, { recursive: true });
      for (const file of files) {
        await writeFile(path.join(uploadsDirectory, file.fileName), file.buffer);
      }

      return;
    } catch (error) {
      lastError = error;
      if (!isWritablePathError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function sanitizeUploadBaseName(fileName: string, fallback: string): string {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || fallback;
  return baseName.toLowerCase().replace(/[^a-z0-9가-힣_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || fallback;
}

function getUploadExtension(file: Express.Multer.File): string {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension) {
    return extension;
  }

  const mimeSubtype = file.mimetype.split('/')[1]?.toLowerCase();
  if (!mimeSubtype) {
    return '.bin';
  }

  if (mimeSubtype === 'jpeg') {
    return '.jpg';
  }

  return `.${mimeSubtype.replace(/[^a-z0-9]/g, '') || 'bin'}`;
}

function normalizeChannelDisplayName(value: string): string {
  const displayName = value.trim().replace(/\s+/g, ' ');
  if (!displayName) {
    throw new HttpError(400, 'Channel name is required.');
  }
  if (displayName.length > CHANNEL_DISPLAY_NAME_MAX_LENGTH) {
    throw new HttpError(400, `Channel name must be ${CHANNEL_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`);
  }

  return displayName;
}

function normalizeChannelBio(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const bio = value.trim();
  if (!bio) {
    return null;
  }
  if (bio.length > CHANNEL_BIO_MAX_LENGTH) {
    throw new HttpError(400, `Channel bio must be ${CHANNEL_BIO_MAX_LENGTH} characters or fewer.`);
  }

  return bio;
}

async function writeChannelImageUpload(input: {
  directoryName: 'channel-avatars' | 'channel-covers';
  fallbackBaseName: string;
  file: Express.Multer.File;
  kind: 'avatar' | 'cover';
}): Promise<ChannelImageUploadWriteResult> {
  const { directoryName, fallbackBaseName, file, kind } = input;
  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'Only image uploads are supported.');
  }

  let webpBuffer: Buffer;
  try {
    const image = sharp(file.buffer);
    webpBuffer = kind === 'avatar'
      ? await image.resize(512, 512, { fit: 'cover' }).webp({ quality: 88 }).toBuffer()
      : await image.webp({ quality: 88 }).toBuffer();
  } catch {
    throw new HttpError(400, 'Invalid image file.');
  }

  const now = new Date();
  const publicUploadScope = randomUUID().replaceAll('-', '').slice(0, 12);
  const relativeDirectory = path.join(directoryName, ...getDatedUploadSegments(now), publicUploadScope);
  const uploadBaseName = `${sanitizeUploadBaseName(file.originalname, fallbackBaseName)}-${now.getTime()}`;
  const originalFileName = `${uploadBaseName}-original${getUploadExtension(file)}`;
  const webpFileName = `${uploadBaseName}.webp`;

  await writeUploadFiles(relativeDirectory, [
    {
      fileName: originalFileName,
      buffer: file.buffer
    },
    {
      fileName: webpFileName,
      buffer: webpBuffer
    }
  ]);

  return {
    publicUrl: path.posix.join('/uploads', ...relativeDirectory.split(path.sep), webpFileName),
    webpBuffer
  };
}

async function syncDiscourseAvatarBestEffort(input: { avatarBuffer: Buffer; fileName: string; userId: string }): Promise<void> {
  try {
    await discourseService.syncUserAvatar({
      buffer: input.avatarBuffer,
      contentType: 'image/webp',
      fileName: input.fileName,
      userId: input.userId
    });
  } catch (error) {
    console.warn('Discourse avatar sync failed.', error);
  }
}

export async function getChannelSubscriptionState(
  channelId: string,
  userId: string
): Promise<ChannelSubscriptionStateResponse> {
  return assertExists(
    await repository.getChannelSubscriptionState(db, {
      channelId,
      userId
    }),
    'Channel not found.'
  );
}

export async function subscribeToChannel(channelId: string, userId: string): Promise<void> {
  assertExists(await repository.getChannelSubscriptionState(db, { channelId, userId }), 'Channel not found.');

  await withTransaction(async (client) => {
    await repository.upsertUserSubscription(client, channelId, userId);
    await projectionService.rebuildChannelProjectionForChannel(client, channelId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_subscribe',
      userId,
      channelId,
      payload: {
        action: 'subscribe'
      }
    });
  });
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  assertExists(await repository.getChannelSubscriptionState(db, { channelId, userId }), 'Channel not found.');

  await withTransaction(async (client) => {
    await repository.deleteUserSubscription(client, channelId, userId);
    await projectionService.rebuildChannelProjectionForChannel(client, channelId);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_subscribe',
      userId,
      channelId,
      payload: {
        action: 'unsubscribe'
      }
    });
  });
}

export async function updateMyChannelProfile(
  input: UpdateChannelProfileRequest,
  userId: string
): Promise<ChannelProfileUpdateResponse> {
  const channel = await withTransaction(async (client) => {
    const defaultChannel = await repository.ensureDefaultChannelForOwner(client, userId);
    const displayName = input.displayName === undefined
      ? defaultChannel.display_name
      : normalizeChannelDisplayName(input.displayName);
    const bio = input.bio === undefined ? defaultChannel.bio : normalizeChannelBio(input.bio);
    const updatedChannel = assertExists(
      await repository.updateChannelProfile(client, {
        channelId: defaultChannel.id,
        displayName,
        bio
      }),
      'Channel not found.'
    );

    await repository.syncFeedItemChannelProfilePayload(client, updatedChannel.id);
    await projectionService.rebuildChannelProjectionForChannel(client, updatedChannel.id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_profile_update',
      userId,
      channelId: updatedChannel.id,
      payload: {
        displayNameChanged: displayName !== defaultChannel.display_name,
        bioChanged: bio !== defaultChannel.bio
      }
    });

    return updatedChannel;
  });
  const home = await projectionService.getChannelHome(channel.slug);

  return {
    channel: home.profile,
    home
  };
}

export async function uploadMyChannelCover(file: Express.Multer.File | undefined, userId: string): Promise<ChannelProfileImageUploadResponse> {
  if (!file) {
    throw new HttpError(400, 'Cover image file is required.');
  }

  const { publicUrl: bannerUrl } = await writeChannelImageUpload({
    directoryName: 'channel-covers',
    fallbackBaseName: 'channel-cover',
    file,
    kind: 'cover'
  });
  const channel = await withTransaction(async (client) => {
    const defaultChannel = await repository.ensureDefaultChannelForOwner(client, userId);
    const updatedChannel = assertExists(
      await repository.updateChannelBannerUrl(client, {
        channelId: defaultChannel.id,
        bannerUrl
      }),
      'Channel not found.'
    );
    await projectionService.rebuildChannelProjectionForChannel(client, updatedChannel.id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_cover_update',
      userId,
      channelId: updatedChannel.id,
      payload: {
        action: 'upload',
        bannerUrl
      }
    });
    return updatedChannel;
  });
  const home = await projectionService.getChannelHome(channel.slug);

  return {
    channel: home.profile,
    home
  };
}

export async function deleteMyChannelCover(userId: string): Promise<ChannelProfileImageUploadResponse> {
  const channel = await withTransaction(async (client) => {
    const defaultChannel = await repository.ensureDefaultChannelForOwner(client, userId);
    const updatedChannel = assertExists(
      await repository.updateChannelBannerUrl(client, {
        channelId: defaultChannel.id,
        bannerUrl: null
      }),
      'Channel not found.'
    );
    await projectionService.rebuildChannelProjectionForChannel(client, updatedChannel.id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_cover_update',
      userId,
      channelId: updatedChannel.id,
      payload: {
        action: 'delete'
      }
    });
    return updatedChannel;
  });
  const home = await projectionService.getChannelHome(channel.slug);

  return {
    channel: home.profile,
    home
  };
}

export async function uploadMyChannelAvatar(file: Express.Multer.File | undefined, userId: string): Promise<ChannelProfileImageUploadResponse> {
  if (!file) {
    throw new HttpError(400, 'Avatar image file is required.');
  }

  const { publicUrl: avatarUrl, webpBuffer: avatarBuffer } = await writeChannelImageUpload({
    directoryName: 'channel-avatars',
    fallbackBaseName: 'channel-avatar',
    file,
    kind: 'avatar'
  });
  const channel = await withTransaction(async (client) => {
    const defaultChannel = await repository.ensureDefaultChannelForOwner(client, userId);
    const updatedChannel = assertExists(
      await repository.updateChannelAvatarUrl(client, {
        channelId: defaultChannel.id,
        avatarUrl
      }),
      'Channel not found.'
    );
    await repository.syncFeedItemChannelProfilePayload(client, updatedChannel.id);
    await projectionService.rebuildChannelProjectionForChannel(client, updatedChannel.id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_avatar_update',
      userId,
      channelId: updatedChannel.id,
      payload: {
        action: 'upload',
        avatarUrl
      }
    });
    return updatedChannel;
  });
  const home = await projectionService.getChannelHome(channel.slug);
  await syncDiscourseAvatarBestEffort({
    avatarBuffer,
    fileName: 'promptoon-channel-avatar.webp',
    userId
  });

  return {
    channel: home.profile,
    home
  };
}

export async function deleteMyChannelAvatar(userId: string): Promise<ChannelProfileImageUploadResponse> {
  const channel = await withTransaction(async (client) => {
    const defaultChannel = await repository.ensureDefaultChannelForOwner(client, userId);
    const updatedChannel = assertExists(
      await repository.updateChannelAvatarUrl(client, {
        channelId: defaultChannel.id,
        avatarUrl: null
      }),
      'Channel not found.'
    );
    await repository.syncFeedItemChannelProfilePayload(client, updatedChannel.id);
    await projectionService.rebuildChannelProjectionForChannel(client, updatedChannel.id);
    await repository.insertTelemetryEvent(client, {
      eventName: 'channel_avatar_update',
      userId,
      channelId: updatedChannel.id,
      payload: {
        action: 'delete'
      }
    });
    return updatedChannel;
  });
  const home = await projectionService.getChannelHome(channel.slug);

  return {
    channel: home.profile,
    home
  };
}
