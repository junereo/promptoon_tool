import type {
  AdminLandingItem,
  AdminLandingResponse,
  FeedItem,
  LandingResponse,
  LandingTargetType
} from '@promptoon/shared';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import * as productRepository from '../promptoon-core/product.repository';
import * as repository from './landing.repository';

const LANDING_PUBLIC_ITEM_LIMIT = 10;
const LANDING_ADMIN_PREVIEW_LIMIT = 3;

type LandingItemBase = Omit<AdminLandingItem, 'previewItems' | 'subtitle' | 'title' | 'visibleItemCount'>;

async function listTargetFeedItems(
  input: {
    limit: number;
    targetId: string;
    targetType: LandingTargetType;
  }
): Promise<FeedItem[]> {
  if (input.targetType === 'publish') {
    const rows = await productRepository.listFeedItemProjectionsByPublishIds(db, [input.targetId]);
    return rows.map((row) => row.item).slice(0, input.limit);
  }

  const rows = await productRepository.listFeedItemProjectionsByProjectId(db, {
    limit: input.limit,
    projectId: input.targetId
  });

  return rows.map((row) => row.item);
}

async function countTargetFeedItems(input: { targetId: string; targetType: LandingTargetType }): Promise<number> {
  if (input.targetType === 'publish') {
    const rows = await productRepository.listFeedItemProjectionsByPublishIds(db, [input.targetId]);
    return rows.length;
  }

  return productRepository.countFeedItemProjectionsByProjectId(db, {
    projectId: input.targetId
  });
}

async function assertTargetCanBeAdded(input: { targetId: string; targetType: LandingTargetType }): Promise<void> {
  if (input.targetType === 'project') {
    const projectTitle = await repository.getProjectTitle(db, input.targetId);
    if (!projectTitle) {
      throw new HttpError(404, 'Project not found.');
    }

    if ((await countTargetFeedItems(input)) === 0) {
      throw new HttpError(400, 'Project has no public landing content.');
    }
    return;
  }

  if ((await countTargetFeedItems(input)) === 0) {
    throw new HttpError(404, 'Published landing content not found.');
  }
}

async function hydrateAdminItem(item: LandingItemBase): Promise<AdminLandingItem> {
  const previewItems = await listTargetFeedItems({
    limit: LANDING_ADMIN_PREVIEW_LIMIT,
    targetId: item.targetId,
    targetType: item.targetType
  });
  const visibleItemCount = await countTargetFeedItems({
    targetId: item.targetId,
    targetType: item.targetType
  });
  const projectTitle = item.targetType === 'project' ? await repository.getProjectTitle(db, item.targetId) : null;
  const firstPreview = previewItems[0] ?? null;

  return {
    ...item,
    title: item.targetType === 'project' ? projectTitle : firstPreview?.episodeTitle ?? null,
    subtitle: item.targetType === 'project' ? `${visibleItemCount}개 공개 콘텐츠` : firstPreview?.projectTitle ?? null,
    visibleItemCount,
    previewItems
  };
}

export async function getLanding(): Promise<LandingResponse> {
  const config = await repository.getConfig(db);
  if (!config.enabled) {
    return {
      enabled: false,
      items: []
    };
  }

  const landingItems = await repository.listItems(db, { status: 'active' });
  const seenPublishIds = new Set<string>();
  const items: FeedItem[] = [];

  for (const landingItem of landingItems) {
    if (items.length >= LANDING_PUBLIC_ITEM_LIMIT) {
      break;
    }

    const targetItems = await listTargetFeedItems({
      limit: LANDING_PUBLIC_ITEM_LIMIT,
      targetId: landingItem.targetId,
      targetType: landingItem.targetType
    });

    for (const item of targetItems) {
      if (seenPublishIds.has(item.publishId)) {
        continue;
      }

      seenPublishIds.add(item.publishId);
      items.push(item);
      if (items.length >= LANDING_PUBLIC_ITEM_LIMIT) {
        break;
      }
    }
  }

  return {
    enabled: true,
    items
  };
}

export async function getAdminLanding(): Promise<AdminLandingResponse> {
  const [config, items] = await Promise.all([
    repository.getConfig(db),
    repository.listItems(db)
  ]);

  return {
    ...config,
    items: await Promise.all(items.map(hydrateAdminItem))
  };
}

export async function updateLandingConfig(enabled: boolean, actorUserId: string): Promise<AdminLandingResponse> {
  await repository.updateConfig(db, {
    enabled,
    updatedBy: actorUserId
  });

  return getAdminLanding();
}

export async function createLandingItem(
  input: {
    targetId: string;
    targetType: LandingTargetType;
  },
  actorUserId: string
): Promise<AdminLandingItem> {
  await assertTargetCanBeAdded(input);
  const item = await repository.insertItem(db, {
    actorUserId,
    targetId: input.targetId,
    targetType: input.targetType
  });

  return hydrateAdminItem(item);
}

export async function updateLandingItemStatus(
  itemId: string,
  status: 'active' | 'disabled',
  actorUserId: string
): Promise<AdminLandingItem> {
  const item = await repository.updateItemStatus(db, {
    itemId,
    status,
    updatedBy: actorUserId
  });
  if (!item) {
    throw new HttpError(404, 'Landing item not found.');
  }

  return hydrateAdminItem(item);
}

export async function updateLandingItemOrder(itemIds: string[], actorUserId: string): Promise<AdminLandingResponse> {
  const uniqueIds = Array.from(new Set(itemIds));
  const items = await repository.listItems(db);
  const existingIds = new Set(items.map((item) => item.id));

  if (uniqueIds.length !== items.length || uniqueIds.some((itemId) => !existingIds.has(itemId))) {
    throw new HttpError(400, 'Landing item order must include every current item exactly once.');
  }

  await withTransaction(async (client) => {
    for (const [index, itemId] of uniqueIds.entries()) {
      await repository.updateItemSortOrder(client, {
        itemId,
        sortOrder: (index + 1) * 100,
        updatedBy: actorUserId
      });
    }
  });

  return getAdminLanding();
}

export async function deleteLandingItem(itemId: string): Promise<void> {
  if (!(await repository.deleteItem(db, itemId))) {
    throw new HttpError(404, 'Landing item not found.');
  }
}
