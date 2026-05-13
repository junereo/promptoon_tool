import type {
  MovingtoonAspectRatio,
  MovingtoonEpisodeSummary,
  MovingtoonProcessingJobSummary,
  MovingtoonProcessingStatus,
  StudioContentPublishStatus
} from '@promptoon/shared';
import type { DbExecutor } from '../../db';

interface MovingtoonEpisodeRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  episode_no: number;
  original_video_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  aspect_ratio: MovingtoonAspectRatio;
  processing_status: MovingtoonProcessingStatus;
  publish_status: StudioContentPublishStatus;
  published_at: Date | null;
  updated_at: Date;
}

interface MovingtoonProcessingJobRow {
  id: string;
  episode_id: string;
  project_id: string;
  project_title: string;
  episode_title: string;
  status: MovingtoonProcessingStatus;
  source_path: string;
  output_scope: string;
  error_message: string | null;
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

export interface MovingtoonProcessingJob extends MovingtoonProcessingJobSummary {
  sourcePath: string;
  outputScope: string;
}

export interface MovingtoonPublishRow {
  id: string;
  project_id: string;
  episode_id: string;
  channel_id: string | null;
  series_id: string | null;
  status: 'published' | 'unpublished';
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function mapEpisode(row: MovingtoonEpisodeRow): MovingtoonEpisodeSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    episodeNumber: row.episode_no,
    originalVideoUrl: row.original_video_url,
    videoAssetId: row.id,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    durationSec: row.duration_sec,
    aspectRatio: row.aspect_ratio,
    processingStatus: row.processing_status,
    publishStatus: row.publish_status,
    publishedAt: row.published_at ? toIsoString(row.published_at) : null,
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapJob(row: MovingtoonProcessingJobRow): MovingtoonProcessingJob {
  return {
    id: row.id,
    episodeId: row.episode_id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    episodeTitle: row.episode_title,
    status: row.status,
    sourcePath: row.source_path,
    outputScope: row.output_scope,
    errorMessage: row.error_message,
    attempts: row.attempts,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export async function createMovingtoonEpisode(
  db: DbExecutor,
  input: {
    projectId: string;
    title: string;
    description?: string | null;
    episodeNumber: number;
    aspectRatio: MovingtoonAspectRatio;
    originalVideoUrl: string;
    createdBy: string;
  }
): Promise<MovingtoonEpisodeSummary> {
  const result = await db.query<MovingtoonEpisodeRow>(
    `INSERT INTO promptoon_movingtoon_episode (
       project_id,
       title,
       description,
       episode_no,
       aspect_ratio,
       original_video_url,
       processing_status,
       publish_status,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'uploading', 'draft', $7)
     RETURNING *`,
    [
      input.projectId,
      input.title,
      input.description ?? null,
      input.episodeNumber,
      input.aspectRatio,
      input.originalVideoUrl,
      input.createdBy
    ]
  );

  return mapEpisode(result.rows[0]);
}

export async function createProcessingJob(
  db: DbExecutor,
  input: {
    episodeId: string;
    projectId: string;
    sourcePath: string;
    outputScope: string;
    createdBy: string;
  }
): Promise<MovingtoonProcessingJob> {
  const result = await db.query<MovingtoonProcessingJobRow>(
    `WITH inserted AS (
       INSERT INTO promptoon_movingtoon_processing_job (episode_id, project_id, source_path, output_scope, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT inserted.*, project.title AS project_title, episode.title AS episode_title
     FROM inserted
     INNER JOIN promptoon_project AS project ON project.id = inserted.project_id
     INNER JOIN promptoon_movingtoon_episode AS episode ON episode.id = inserted.episode_id`,
    [input.episodeId, input.projectId, input.sourcePath, input.outputScope, input.createdBy]
  );

  return mapJob(result.rows[0]);
}

export async function getProcessingJobById(db: DbExecutor, jobId: string): Promise<MovingtoonProcessingJob | null> {
  const result = await db.query<MovingtoonProcessingJobRow>(
    `SELECT job.*, project.title AS project_title, episode.title AS episode_title
     FROM promptoon_movingtoon_processing_job AS job
     INNER JOIN promptoon_project AS project ON project.id = job.project_id
     INNER JOIN promptoon_movingtoon_episode AS episode ON episode.id = job.episode_id
     WHERE job.id = $1`,
    [jobId]
  );

  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function listUploadQueue(db: DbExecutor, userId: string): Promise<MovingtoonProcessingJobSummary[]> {
  const result = await db.query<MovingtoonProcessingJobRow>(
    `SELECT job.*, project.title AS project_title, episode.title AS episode_title
     FROM promptoon_movingtoon_processing_job AS job
     INNER JOIN promptoon_project AS project ON project.id = job.project_id
     INNER JOIN promptoon_movingtoon_episode AS episode ON episode.id = job.episode_id
     WHERE job.status IN ('uploading', 'processing', 'failed')
       AND (
         project.created_by = $1
         OR EXISTS (
           SELECT 1
           FROM promptoon_project_member AS member
           WHERE member.project_id = project.id
             AND member.user_id = $1
         )
       )
     ORDER BY job.updated_at DESC, job.id DESC
     LIMIT 50`,
    [userId]
  );

  return result.rows.map(mapJob);
}

export async function markJobProcessing(db: DbExecutor, jobId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_movingtoon_processing_job
     SET status = 'processing',
         attempts = attempts + 1,
         error_message = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [jobId]
  );
}

export async function markJobReady(
  db: DbExecutor,
  input: {
    jobId: string;
    episodeId: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    durationSec: number | null;
  }
): Promise<void> {
  await db.query(
    `UPDATE promptoon_movingtoon_episode
     SET video_url = $2,
         thumbnail_url = $3,
         duration_sec = $4,
         processing_status = 'ready',
         updated_at = NOW()
     WHERE id = $1`,
    [input.episodeId, input.videoUrl, input.thumbnailUrl, input.durationSec]
  );

  await db.query(
    `UPDATE promptoon_movingtoon_processing_job
     SET status = 'ready',
         error_message = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [input.jobId]
  );
}

export async function markJobFailed(
  db: DbExecutor,
  input: {
    jobId: string;
    episodeId: string;
    errorMessage: string;
  }
): Promise<void> {
  await db.query(
    `UPDATE promptoon_movingtoon_episode
     SET processing_status = 'failed',
         updated_at = NOW()
     WHERE id = $1`,
    [input.episodeId]
  );

  await db.query(
    `UPDATE promptoon_movingtoon_processing_job
     SET status = 'failed',
         error_message = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [input.jobId, input.errorMessage]
  );
}

export async function resetEpisodeForProcessing(db: DbExecutor, episodeId: string): Promise<MovingtoonProcessingJob | null> {
  await db.query(
    `UPDATE promptoon_movingtoon_episode
     SET processing_status = 'uploading',
         updated_at = NOW()
     WHERE id = $1`,
    [episodeId]
  );

  const result = await db.query<MovingtoonProcessingJobRow>(
    `UPDATE promptoon_movingtoon_processing_job
     SET status = 'uploading',
         error_message = NULL,
         updated_at = NOW()
     WHERE id = (
       SELECT id
       FROM promptoon_movingtoon_processing_job
       WHERE episode_id = $1
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING
       promptoon_movingtoon_processing_job.*,
       (SELECT title FROM promptoon_project WHERE id = promptoon_movingtoon_processing_job.project_id) AS project_title,
       (SELECT title FROM promptoon_movingtoon_episode WHERE id = promptoon_movingtoon_processing_job.episode_id) AS episode_title`,
    [episodeId]
  );

  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function getEpisodeById(db: DbExecutor, episodeId: string): Promise<MovingtoonEpisodeSummary | null> {
  const result = await db.query<MovingtoonEpisodeRow>('SELECT * FROM promptoon_movingtoon_episode WHERE id = $1', [episodeId]);
  return result.rows[0] ? mapEpisode(result.rows[0]) : null;
}

export async function createMovingtoonPublish(
  db: DbExecutor,
  input: {
    projectId: string;
    episodeId: string;
    channelId: string | null;
    seriesId: string | null;
    createdBy: string;
  }
): Promise<MovingtoonPublishRow> {
  await db.query(
    `UPDATE promptoon_movingtoon_publish
     SET status = 'unpublished',
         updated_at = NOW()
     WHERE episode_id = $1
       AND status = 'published'`,
    [input.episodeId]
  );

  const result = await db.query<MovingtoonPublishRow>(
    `INSERT INTO promptoon_movingtoon_publish (project_id, episode_id, channel_id, series_id, status, created_by)
     VALUES ($1, $2, $3, $4, 'published', $5)
     RETURNING *`,
    [input.projectId, input.episodeId, input.channelId, input.seriesId, input.createdBy]
  );

  await db.query(
    `UPDATE promptoon_movingtoon_episode
     SET publish_status = 'published',
         published_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [input.episodeId]
  );

  return result.rows[0];
}

export async function markProjectPublished(db: DbExecutor, projectId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_project
     SET status = 'published',
         updated_at = NOW()
     WHERE id = $1`,
    [projectId]
  );
}

export async function markProjectDraftIfNoPublishedContent(db: DbExecutor, projectId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_project
     SET status = 'draft',
         updated_at = NOW()
     WHERE id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM promptoon_episode
         WHERE project_id = $1
           AND status = 'published'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM promptoon_movingtoon_episode
         WHERE project_id = $1
           AND publish_status = 'published'
       )`,
    [projectId]
  );
}

export async function getActiveMovingtoonPublish(db: DbExecutor, episodeId: string): Promise<MovingtoonPublishRow | null> {
  const result = await db.query<MovingtoonPublishRow>(
    `SELECT *
     FROM promptoon_movingtoon_publish
     WHERE episode_id = $1
       AND status = 'published'
     ORDER BY created_at DESC
     LIMIT 1`,
    [episodeId]
  );

  return result.rows[0] ?? null;
}

export async function unpublishMovingtoonEpisode(db: DbExecutor, episodeId: string): Promise<MovingtoonPublishRow | null> {
  const existing = await getActiveMovingtoonPublish(db, episodeId);
  if (!existing) {
    return null;
  }

  await db.query(
    `UPDATE promptoon_movingtoon_publish
     SET status = 'unpublished',
         updated_at = NOW()
     WHERE id = $1`,
    [existing.id]
  );
  await db.query(
    `UPDATE promptoon_movingtoon_episode
     SET publish_status = 'draft',
         updated_at = NOW()
     WHERE id = $1`,
    [episodeId]
  );

  return existing;
}
