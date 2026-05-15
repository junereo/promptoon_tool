import type { AdminLandingItem, LandingItemStatus, LandingTargetType } from '@promptoon/shared';

import type { DbExecutor } from '../../db';

interface LandingConfigRow {
  enabled: boolean;
  updated_by: string | null;
  updated_at: Date;
}

interface LandingItemRow {
  id: string;
  target_type: LandingTargetType;
  target_id: string;
  status: LandingItemStatus;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapItem(row: LandingItemRow): Omit<AdminLandingItem, 'previewItems' | 'subtitle' | 'title' | 'visibleItemCount'> {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getConfig(db: DbExecutor): Promise<{ enabled: boolean; updatedBy: string | null; updatedAt: string | null }> {
  const result = await db.query<LandingConfigRow>(
    `SELECT enabled, updated_by, updated_at
     FROM promptoon_landing_config
     WHERE id = TRUE
     LIMIT 1`
  );
  const row = result.rows[0];

  return {
    enabled: row?.enabled ?? true,
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at.toISOString() ?? null
  };
}

export async function updateConfig(
  db: DbExecutor,
  input: {
    enabled: boolean;
    updatedBy: string;
  }
): Promise<{ enabled: boolean; updatedBy: string | null; updatedAt: string | null }> {
  const result = await db.query<LandingConfigRow>(
    `INSERT INTO promptoon_landing_config (id, enabled, updated_by, updated_at)
     VALUES (TRUE, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING enabled, updated_by, updated_at`,
    [input.enabled, input.updatedBy]
  );
  const row = result.rows[0];

  return {
    enabled: row.enabled,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString()
  };
}

export async function listItems(
  db: DbExecutor,
  input: {
    status?: LandingItemStatus;
  } = {}
): Promise<Array<Omit<AdminLandingItem, 'previewItems' | 'subtitle' | 'title' | 'visibleItemCount'>>> {
  const values: unknown[] = [];
  const statusClause = input.status ? `WHERE status = $${values.push(input.status)}` : '';
  const result = await db.query<LandingItemRow>(
    `SELECT id, target_type, target_id, status, sort_order, created_by, updated_by, created_at, updated_at
     FROM promptoon_landing_item
     ${statusClause}
     ORDER BY sort_order ASC, created_at ASC, id ASC`,
    values
  );

  return result.rows.map(mapItem);
}

export async function insertItem(
  db: DbExecutor,
  input: {
    actorUserId: string;
    targetId: string;
    targetType: LandingTargetType;
  }
): Promise<Omit<AdminLandingItem, 'previewItems' | 'subtitle' | 'title' | 'visibleItemCount'>> {
  const result = await db.query<LandingItemRow>(
    `WITH next_order AS (
       SELECT COALESCE(MAX(sort_order), 0) + 100 AS sort_order
       FROM promptoon_landing_item
     )
     INSERT INTO promptoon_landing_item (target_type, target_id, status, sort_order, created_by, updated_by)
     SELECT $1, $2, 'active', next_order.sort_order, $3, $3
     FROM next_order
     ON CONFLICT (target_type, target_id) DO UPDATE
       SET status = 'active',
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
     RETURNING id, target_type, target_id, status, sort_order, created_by, updated_by, created_at, updated_at`,
    [input.targetType, input.targetId, input.actorUserId]
  );

  return mapItem(result.rows[0]);
}

export async function updateItemStatus(
  db: DbExecutor,
  input: {
    itemId: string;
    status: LandingItemStatus;
    updatedBy: string;
  }
): Promise<Omit<AdminLandingItem, 'previewItems' | 'subtitle' | 'title' | 'visibleItemCount'> | null> {
  const result = await db.query<LandingItemRow>(
    `UPDATE promptoon_landing_item
     SET status = $2,
         updated_by = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, target_type, target_id, status, sort_order, created_by, updated_by, created_at, updated_at`,
    [input.itemId, input.status, input.updatedBy]
  );

  return result.rows[0] ? mapItem(result.rows[0]) : null;
}

export async function deleteItem(db: DbExecutor, itemId: string): Promise<boolean> {
  const result = await db.query('DELETE FROM promptoon_landing_item WHERE id = $1', [itemId]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateItemSortOrder(
  db: DbExecutor,
  input: {
    itemId: string;
    sortOrder: number;
    updatedBy: string;
  }
): Promise<void> {
  await db.query(
    `UPDATE promptoon_landing_item
     SET sort_order = $2,
         updated_by = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [input.itemId, input.sortOrder, input.updatedBy]
  );
}

export async function getProjectTitle(db: DbExecutor, projectId: string): Promise<string | null> {
  const result = await db.query<{ title: string }>(
    `SELECT title
     FROM promptoon_project
     WHERE id = $1
     LIMIT 1`,
    [projectId]
  );

  return result.rows[0]?.title ?? null;
}
