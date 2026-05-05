import type { ProjectAssetHistoryItem, ProjectAssetSummary } from '@promptoon/shared';

import type { DbExecutor } from '../../db';

interface AssetRow {
  id: string;
  project_id: string;
  asset_url: string;
  source: ProjectAssetSummary['source'];
  metadata_json: Record<string, unknown> | null;
  current_version: number;
  status: ProjectAssetSummary['status'];
  updated_at: Date;
}

interface AssetHistoryRow {
  id: string;
  asset_id: string | null;
  project_id: string;
  action: ProjectAssetHistoryItem['action'];
  previous_asset_url: string | null;
  next_asset_url: string | null;
  metadata_json: Record<string, unknown> | null;
  created_by: string | null;
  created_at: Date;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function mapHistory(row: AssetHistoryRow): ProjectAssetHistoryItem {
  return {
    id: row.id,
    action: row.action,
    previousAssetUrl: row.previous_asset_url,
    nextAssetUrl: row.next_asset_url,
    metadata: row.metadata_json ?? {},
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at)
  };
}

function mapAsset(row: AssetRow, history: ProjectAssetHistoryItem[]): ProjectAssetSummary {
  return {
    assetId: row.id,
    assetUrl: row.asset_url,
    source: row.source,
    metadata: row.metadata_json ?? {},
    currentVersion: row.current_version,
    status: row.status ?? 'active',
    history,
    updatedAt: toIsoString(row.updated_at)
  };
}

async function appendAssetHistory(
  db: DbExecutor,
  input: {
    assetId: string | null;
    projectId: string;
    action: ProjectAssetHistoryItem['action'];
    previousAssetUrl?: string | null;
    nextAssetUrl?: string | null;
    metadata?: Record<string, unknown>;
    userId: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO promptoon_asset_history (
       asset_id,
       project_id,
       action,
       previous_asset_url,
       next_asset_url,
       metadata_json,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.assetId,
      input.projectId,
      input.action,
      input.previousAssetUrl ?? null,
      input.nextAssetUrl ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.userId
    ]
  );
}

export async function listTrackedProjectAssets(db: DbExecutor, projectId: string): Promise<ProjectAssetSummary[]> {
  const assets = await db.query<AssetRow>(
    `SELECT id, project_id, asset_url, source, metadata_json, current_version, status, updated_at
     FROM promptoon_asset
     WHERE project_id = $1
     ORDER BY updated_at DESC, id DESC`,
    [projectId]
  );

  if (assets.rows.length === 0) {
    return [];
  }

  const history = await db.query<AssetHistoryRow>(
    `SELECT id, asset_id, project_id, action, previous_asset_url, next_asset_url, metadata_json, created_by, created_at
     FROM promptoon_asset_history
     WHERE project_id = $1
       AND asset_id = ANY($2::uuid[])
     ORDER BY created_at DESC, id DESC`,
    [projectId, assets.rows.map((row) => row.id)]
  );
  const historyByAssetId = new Map<string, ProjectAssetHistoryItem[]>();
  for (const row of history.rows) {
    if (!row.asset_id) {
      continue;
    }
    const list = historyByAssetId.get(row.asset_id) ?? [];
    list.push(mapHistory(row));
    historyByAssetId.set(row.asset_id, list);
  }

  return assets.rows.map((row) => mapAsset(row, historyByAssetId.get(row.id) ?? []));
}

export async function recordUploadedAsset(
  db: DbExecutor,
  input: {
    projectId: string;
    assetUrl: string;
    metadata: Record<string, unknown>;
    userId: string;
  }
): Promise<ProjectAssetSummary> {
  const existing = await db.query<AssetRow>(
    `SELECT id, project_id, asset_url, source, metadata_json, current_version, status, updated_at
     FROM promptoon_asset
     WHERE project_id = $1
       AND asset_url = $2`,
    [input.projectId, input.assetUrl]
  );
  const row = existing.rows[0];

  if (row) {
    const updated = await db.query<AssetRow>(
      `UPDATE promptoon_asset
       SET metadata_json = $3,
           status = 'active',
           updated_at = NOW()
       WHERE project_id = $1
         AND asset_url = $2
       RETURNING id, project_id, asset_url, source, metadata_json, current_version, status, updated_at`,
      [input.projectId, input.assetUrl, JSON.stringify(input.metadata)]
    );
    await appendAssetHistory(db, {
      assetId: updated.rows[0].id,
      projectId: input.projectId,
      action: 'metadata_updated',
      nextAssetUrl: input.assetUrl,
      metadata: input.metadata,
      userId: input.userId
    });
    return mapAsset(updated.rows[0], []);
  }

  const created = await db.query<AssetRow>(
    `INSERT INTO promptoon_asset (project_id, asset_url, source, metadata_json, created_by)
     VALUES ($1, $2, 'upload', $3, $4)
     RETURNING id, project_id, asset_url, source, metadata_json, current_version, status, updated_at`,
    [input.projectId, input.assetUrl, JSON.stringify(input.metadata), input.userId]
  );
  await appendAssetHistory(db, {
    assetId: created.rows[0].id,
    projectId: input.projectId,
    action: 'created',
    nextAssetUrl: input.assetUrl,
    metadata: input.metadata,
    userId: input.userId
  });

  return mapAsset(created.rows[0], []);
}

export async function updateAssetMetadata(
  db: DbExecutor,
  input: {
    projectId: string;
    assetId: string;
    metadata: Record<string, unknown>;
    userId: string;
  }
): Promise<ProjectAssetSummary | null> {
  const result = await db.query<AssetRow>(
    `UPDATE promptoon_asset
     SET metadata_json = $3,
         updated_at = NOW()
     WHERE project_id = $1
       AND id = $2
     RETURNING id, project_id, asset_url, source, metadata_json, current_version, status, updated_at`,
    [input.projectId, input.assetId, JSON.stringify(input.metadata)]
  );

  if (!result.rows[0]) {
    return null;
  }

  await appendAssetHistory(db, {
    assetId: input.assetId,
    projectId: input.projectId,
    action: 'metadata_updated',
    nextAssetUrl: result.rows[0].asset_url,
    metadata: input.metadata,
    userId: input.userId
  });

  return mapAsset(result.rows[0], []);
}

export async function markAssetDeleted(
  db: DbExecutor,
  input: {
    projectId: string;
    assetId: string;
    userId: string;
  }
): Promise<boolean> {
  const result = await db.query<AssetRow>(
    `UPDATE promptoon_asset
     SET status = 'deleted',
         updated_at = NOW()
     WHERE project_id = $1
       AND id = $2
     RETURNING id, project_id, asset_url, source, metadata_json, current_version, status, updated_at`,
    [input.projectId, input.assetId]
  );

  if (!result.rows[0]) {
    return false;
  }

  await appendAssetHistory(db, {
    assetId: input.assetId,
    projectId: input.projectId,
    action: 'deleted',
    previousAssetUrl: result.rows[0].asset_url,
    metadata: result.rows[0].metadata_json ?? {},
    userId: input.userId
  });

  return true;
}

export async function replaceAsset(
  db: DbExecutor,
  input: {
    projectId: string;
    assetId: string;
    nextAssetUrl: string;
    metadata: Record<string, unknown>;
    userId: string;
  }
): Promise<ProjectAssetSummary | null> {
  const existing = await db.query<AssetRow>(
    `SELECT id, project_id, asset_url, source, metadata_json, current_version, status, updated_at
     FROM promptoon_asset
     WHERE project_id = $1
       AND id = $2`,
    [input.projectId, input.assetId]
  );
  const row = existing.rows[0];
  if (!row) {
    return null;
  }

  const updated = await db.query<AssetRow>(
    `UPDATE promptoon_asset
     SET asset_url = $3,
         metadata_json = $4,
         current_version = current_version + 1,
         status = 'active',
         updated_at = NOW()
     WHERE project_id = $1
       AND id = $2
     RETURNING id, project_id, asset_url, source, metadata_json, current_version, status, updated_at`,
    [input.projectId, input.assetId, input.nextAssetUrl, JSON.stringify(input.metadata)]
  );

  await appendAssetHistory(db, {
    assetId: input.assetId,
    projectId: input.projectId,
    action: 'replaced',
    previousAssetUrl: row.asset_url,
    nextAssetUrl: input.nextAssetUrl,
    metadata: input.metadata,
    userId: input.userId
  });

  return mapAsset(updated.rows[0], []);
}
