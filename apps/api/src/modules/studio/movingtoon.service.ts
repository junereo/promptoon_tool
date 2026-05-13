import type {
  CreateMovingtoonEpisodeRequest,
  CreateMovingtoonEpisodeResponse,
  FeedItem,
  MovingtoonEpisodeSummary,
  MovingtoonProcessingJobSummary
} from '@promptoon/shared';
import { randomUUID } from 'node:crypto';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../../lib/workspace-paths';
import * as productRepository from '../promptoon-core/product.repository';
import { rebuildChannelProjectionForChannel } from '../promptoon-core/projection.service';
import * as authorizationService from './authorization.service';
import * as movingtoonRepository from './movingtoon.repository';
import { processMovingtoonVideo } from './movingtoon.processor';
import * as projectRepository from './project.repository';

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function getDatedUploadSegments(now: Date): [string, string, string] {
  return [String(now.getFullYear()), padDatePart(now.getMonth() + 1), padDatePart(now.getDate())];
}

function getUploadExtension(file: Express.Multer.File): string {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension) {
    return extension;
  }

  const subtype = file.mimetype.split('/')[1]?.toLowerCase();
  return subtype ? `.${subtype.replace(/[^a-z0-9]/g, '')}` : '.bin';
}

function buildPublicUrl(relativePath: string): string {
  return path.posix.join('/uploads', ...relativePath.split(path.sep));
}

function isWritablePathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'EROFS'].includes(String(error.code));
}

async function getWritableUploadsDirectory(relativeDirectory: string): Promise<string> {
  const directoryCandidates = [
    resolveFromWorkspaceRoot('.data/uploads', relativeDirectory),
    resolveFromApiRoot('.data/uploads', relativeDirectory)
  ];
  let lastError: unknown = null;

  for (const uploadsDirectory of directoryCandidates) {
    try {
      await mkdir(uploadsDirectory, { recursive: true });
      return uploadsDirectory;
    } catch (error) {
      lastError = error;
      if (!isWritablePathError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to create movingtoon upload directory.');
}

function createFallbackStartCut(episode: MovingtoonEpisodeSummary): FeedItem['startCut'] {
  return {
    id: episode.id,
    title: episode.title,
    body: episode.description ?? '',
    contentBlocks: [],
    contentViewMode: 'default',
    assetUrl: episode.thumbnailUrl,
    dialogAnchorX: 'center',
    dialogAnchorY: 'bottom',
    dialogOffsetX: 0,
    dialogOffsetY: 0,
    dialogTextAlign: 'left',
    startEffect: 'none',
    endEffect: 'none',
    startEffectDurationMs: 0,
    endEffectDurationMs: 0,
    edgeFade: 'bottom',
    edgeFadeIntensity: 'soft',
    edgeFadeColor: 'black',
    marginBottomToken: 'base'
  };
}

function buildMovingtoonFeedItem(input: {
  publishId: string;
  project: NonNullable<Awaited<ReturnType<typeof projectRepository.getProjectById>>>;
  episode: MovingtoonEpisodeSummary;
  channel: productRepository.ProductChannelRow;
  publishedAt: string;
}): FeedItem {
  return {
    type: 'short_drama',
    publishId: input.publishId,
    episodeId: input.episode.id,
    channelId: input.channel.id,
    channelSlug: input.channel.slug,
    channelName: input.channel.display_name,
    channelAvatarUrl: input.channel.avatar_url,
    episodeTitle: input.episode.title,
    projectTitle: input.project.title,
    coverImageUrl: input.episode.thumbnailUrl ?? input.project.thumbnailUrl,
    videoUrl: input.episode.videoUrl,
    durationSec: input.episode.durationSec,
    publishedAt: input.publishedAt,
    metrics: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    },
    entry: {
      kind: 'viewer',
      href: `/shorts/${input.publishId}`
    },
    startCut: createFallbackStartCut(input.episode),
    startChoices: []
  };
}

async function moveOriginalVideo(file: Express.Multer.File): Promise<{ sourcePath: string; originalVideoUrl: string; outputScope: string }> {
  if (!file.path) {
    throw new HttpError(400, 'Video file is required.');
  }

  if (!file.mimetype.startsWith('video/')) {
    throw new HttpError(400, 'Only video uploads are supported.');
  }

  const now = new Date();
  const outputScope = randomUUID().replaceAll('-', '');
  const relativeDirectory = path.join(...getDatedUploadSegments(now), outputScope);
  const uploadsDirectory = await getWritableUploadsDirectory(relativeDirectory);
  const originalFileName = `original${getUploadExtension(file)}`;
  const sourcePath = path.join(uploadsDirectory, originalFileName);

  await rename(file.path, sourcePath);

  return {
    sourcePath,
    originalVideoUrl: buildPublicUrl(path.join(relativeDirectory, originalFileName)),
    outputScope
  };
}

async function processJob(jobId: string): Promise<void> {
  const job = await movingtoonRepository.getProcessingJobById(db, jobId);
  if (!job) {
    return;
  }

  await movingtoonRepository.markJobProcessing(db, job.id);

  try {
    const processed = await processMovingtoonVideo(job.sourcePath, job.outputScope);
    await movingtoonRepository.markJobReady(db, {
      jobId: job.id,
      episodeId: job.episodeId,
      videoUrl: processed.videoUrl,
      thumbnailUrl: processed.thumbnailUrl,
      durationSec: processed.durationSec
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Movingtoon processing failed.';
    await movingtoonRepository.markJobFailed(db, {
      jobId: job.id,
      episodeId: job.episodeId,
      errorMessage: message.slice(0, 500)
    });
  }
}

function enqueueProcessingJob(jobId: string): void {
  void processJob(jobId).catch(() => undefined);
}

export async function createMovingtoonEpisode(
  projectId: string,
  request: CreateMovingtoonEpisodeRequest,
  file: Express.Multer.File,
  userId: string
): Promise<CreateMovingtoonEpisodeResponse> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  const prepared = await moveOriginalVideo(file);

  const result = await withTransaction(async (client) => {
    const episode = await movingtoonRepository.createMovingtoonEpisode(client, {
      projectId,
      title: request.title,
      description: request.description,
      episodeNumber: request.episodeNumber,
      aspectRatio: request.aspectRatio,
      originalVideoUrl: prepared.originalVideoUrl,
      createdBy: userId
    });
    const job = await movingtoonRepository.createProcessingJob(client, {
      episodeId: episode.id,
      projectId,
      sourcePath: prepared.sourcePath,
      outputScope: prepared.outputScope,
      createdBy: userId
    });

    return {
      episode,
      job
    };
  });

  enqueueProcessingJob(result.job.id);

  return result;
}

export function listUploadQueue(userId: string): Promise<MovingtoonProcessingJobSummary[]> {
  return movingtoonRepository.listUploadQueue(db, userId);
}

export async function reprocessMovingtoonEpisode(episodeId: string, userId: string): Promise<MovingtoonProcessingJobSummary> {
  await authorizationService.ensureMovingtoonEpisodeProjectRole(
    episodeId,
    userId,
    authorizationService.PROJECT_WRITE_ROLES
  );
  const job = await movingtoonRepository.resetEpisodeForProcessing(db, episodeId);
  if (!job) {
    throw new HttpError(404, 'Movingtoon processing job not found.');
  }

  enqueueProcessingJob(job.id);
  return job;
}

export async function publishMovingtoonEpisode(episodeId: string, userId: string): Promise<MovingtoonEpisodeSummary> {
  await authorizationService.ensureMovingtoonEpisodeProjectRole(
    episodeId,
    userId,
    authorizationService.PROJECT_PUBLISH_ROLES
  );

  const episode = authorizationService.assertExists(
    await movingtoonRepository.getEpisodeById(db, episodeId),
    'Movingtoon episode not found.'
  );

  if (episode.processingStatus !== 'ready' || !episode.videoUrl) {
    throw new HttpError(409, 'Movingtoon episode is not ready to publish.');
  }

  const project = authorizationService.assertExists(
    await projectRepository.getProjectById(db, episode.projectId),
    'Project not found.'
  );

  await withTransaction(async (client) => {
    const channel = await productRepository.ensureDefaultChannelForProject(client, project, userId);
    const series = await productRepository.ensureDefaultSeriesForProject(client, {
      project,
      channelId: channel.id
    });
    const publish = await movingtoonRepository.createMovingtoonPublish(client, {
      projectId: project.id,
      episodeId: episode.id,
      channelId: channel.id,
      seriesId: series.id,
      createdBy: userId
    });
    await movingtoonRepository.markProjectPublished(client, project.id);
    const publishedAt = publish.created_at.toISOString();
    const feedItem = buildMovingtoonFeedItem({
      publishId: publish.id,
      project,
      episode,
      channel,
      publishedAt
    });

    await client.query(
      `INSERT INTO promptoon_feed_item (
         movingtoon_publish_id,
         project_id,
         channel_id,
         series_id,
         movingtoon_episode_id,
         item_type,
         title,
         description,
         cover_image_url,
         video_url,
         duration_sec,
         choice_count,
         entry_json,
         payload_json,
         published_at
       )
       VALUES ($1, $2, $3, $4, $5, 'short_drama', $6, $7, $8, $9, $10, 0, $11, $12, $13)
       ON CONFLICT (movingtoon_episode_id) WHERE movingtoon_episode_id IS NOT NULL DO UPDATE
         SET movingtoon_publish_id = EXCLUDED.movingtoon_publish_id,
             project_id = EXCLUDED.project_id,
             channel_id = EXCLUDED.channel_id,
             series_id = EXCLUDED.series_id,
             item_type = EXCLUDED.item_type,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             cover_image_url = EXCLUDED.cover_image_url,
             video_url = EXCLUDED.video_url,
             duration_sec = EXCLUDED.duration_sec,
             entry_json = EXCLUDED.entry_json,
             payload_json = EXCLUDED.payload_json,
             published_at = EXCLUDED.published_at,
             updated_at = NOW()`,
      [
        publish.id,
        project.id,
        channel.id,
        series.id,
        episode.id,
        episode.title,
        episode.description,
        episode.thumbnailUrl ?? project.thumbnailUrl,
        episode.videoUrl,
        episode.durationSec,
        JSON.stringify(feedItem.entry),
        JSON.stringify(feedItem),
        publishedAt
      ]
    );

    await client.query(
      `INSERT INTO promptoon_short_clip (
         project_id,
         channel_id,
         series_id,
         title,
         description,
         video_url,
         thumbnail_url,
         duration_sec,
         status,
         published_at,
         movingtoon_publish_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), 'published', $9, $10)
       ON CONFLICT (movingtoon_publish_id) WHERE movingtoon_publish_id IS NOT NULL DO UPDATE
         SET project_id = EXCLUDED.project_id,
             channel_id = EXCLUDED.channel_id,
             series_id = EXCLUDED.series_id,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             video_url = EXCLUDED.video_url,
             thumbnail_url = EXCLUDED.thumbnail_url,
             duration_sec = EXCLUDED.duration_sec,
             status = EXCLUDED.status,
             published_at = EXCLUDED.published_at`,
      [
        project.id,
        channel.id,
        series.id,
        episode.title,
        episode.description,
        episode.videoUrl,
        episode.thumbnailUrl,
        episode.durationSec,
        publishedAt,
        publish.id
      ]
    );

    await rebuildChannelProjectionForChannel(client, channel.id);
  });

  return authorizationService.assertExists(await movingtoonRepository.getEpisodeById(db, episodeId), 'Movingtoon episode not found.');
}

export async function unpublishMovingtoonEpisode(episodeId: string, userId: string): Promise<void> {
  await authorizationService.ensureMovingtoonEpisodeProjectRole(
    episodeId,
    userId,
    authorizationService.PROJECT_PUBLISH_ROLES
  );

  await withTransaction(async (client) => {
    const publish = await movingtoonRepository.unpublishMovingtoonEpisode(client, episodeId);
    if (!publish) {
      return;
    }

    await client.query('DELETE FROM promptoon_feed_item WHERE movingtoon_publish_id = $1', [publish.id]);
    await client.query("UPDATE promptoon_short_clip SET status = 'unpublished' WHERE movingtoon_publish_id = $1", [publish.id]);
    await movingtoonRepository.markProjectDraftIfNoPublishedContent(client, publish.project_id);
    await rebuildChannelProjectionForChannel(client, publish.channel_id);
  });
}
