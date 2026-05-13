import type { Publish, PublishManifest } from '@promptoon/shared';
import { randomUUID } from 'node:crypto';

import type { DbExecutor } from '../../db';

type PublishRow = {
  id: string;
  project_id: string;
  episode_id: string;
  version_no: number;
  status: 'published';
  manifest: PublishManifest;
  created_by: string;
  created_at: Date;
};

function toIsoString(value: Date): string {
  return value.toISOString();
}

function mapPublish(row: PublishRow): Publish {
  return {
    id: row.id,
    projectId: row.project_id,
    episodeId: row.episode_id,
    versionNo: row.version_no,
    status: row.status,
    manifest: row.manifest,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at)
  };
}

export async function getPreviousProjectPublish(
  db: DbExecutor,
  input: { projectId: string; episodeId: string; versionNo: number; createdAt: string; publishId: string }
): Promise<Publish | null> {
  const result = await db.query<PublishRow>(
    `SELECT *
     FROM promptoon_publish
     WHERE project_id = $1
       AND episode_id = $2
       AND (version_no, created_at, id) < ($3::integer, $4::timestamptz, $5::uuid)
     ORDER BY version_no DESC, created_at DESC, id DESC
     LIMIT 1`,
    [input.projectId, input.episodeId, input.versionNo, input.createdAt, input.publishId]
  );

  return result.rows[0] ? mapPublish(result.rows[0]) : null;
}

export async function getLatestPublishVersion(db: DbExecutor, projectId: string, episodeId: string): Promise<number> {
  const result = await db.query<{ version_no: number }>(
    `SELECT version_no
     FROM promptoon_publish
     WHERE project_id = $1 AND episode_id = $2
     ORDER BY version_no DESC
     LIMIT 1`,
    [projectId, episodeId]
  );

  return result.rows[0]?.version_no ?? 0;
}

export async function getLatestPublishByEpisodeId(db: DbExecutor, episodeId: string): Promise<Publish | null> {
  const result = await db.query<PublishRow>(
    `SELECT *
       FROM promptoon_publish
      WHERE episode_id = $1
      ORDER BY version_no DESC, created_at DESC
      LIMIT 1`,
    [episodeId]
  );

  return result.rows[0] ? mapPublish(result.rows[0]) : null;
}

export async function createPublish(
  db: DbExecutor,
  input: {
    projectId: string;
    episodeId: string;
    channelId?: string | null;
    seriesId?: string | null;
    versionNo: number;
    manifest: PublishManifest;
    createdBy: string;
  }
): Promise<Publish> {
  const result = await db.query<PublishRow>(
    `INSERT INTO promptoon_publish (id, project_id, episode_id, channel_id, series_id, version_no, status, manifest, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $8)
     RETURNING *`,
    [
      randomUUID(),
      input.projectId,
      input.episodeId,
      input.channelId ?? null,
      input.seriesId ?? null,
      input.versionNo,
      JSON.stringify(input.manifest),
      input.createdBy
    ]
  );

  return mapPublish(result.rows[0]);
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

export async function markEpisodePublished(db: DbExecutor, episodeId: string): Promise<void> {
  await db.query(
    `UPDATE promptoon_episode
     SET status = 'published',
         updated_at = NOW()
     WHERE id = $1`,
    [episodeId]
  );
}
