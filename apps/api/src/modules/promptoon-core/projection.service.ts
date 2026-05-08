import type {
  ChannelHome,
  CommentsMetaResponse,
  FeedHomeResponse,
  FeedItem,
  FeedResponse,
  Publish,
  RebuildPublicProjectionsResponse,
  RelatedShort
} from '@promptoon/shared';

import { db, type DbExecutor } from '../../db';
import { HttpError } from '../../lib/http-error';
import {
  buildFeedItem,
  buildProjectedFeedItem,
  normalizePublish,
  toPublicPublish
} from './publication.service';
import * as repository from './product.repository';

type FeedProjectionInput = repository.FeedProjectionInput;

interface FeedCursorPayload {
  createdAt: string;
  publishId: string;
}

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function assertPublicPublish(value: Publish | null, message: string): Publish {
  const publish = assertExists(value, message);
  if (publish.status !== 'published') {
    throw new HttpError(404, message);
  }

  return publish;
}

export function encodeFeedCursor(payload: FeedCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeFeedCursor(cursor: string): FeedCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<FeedCursorPayload>;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.publishId !== 'string') {
      throw new Error('Invalid feed cursor.');
    }

    return {
      createdAt: parsed.createdAt,
      publishId: parsed.publishId
    };
  } catch {
    throw new HttpError(400, 'Invalid feed cursor.');
  }
}

export async function getPublishedEpisode(publishId: string): Promise<Publish> {
  return toPublicPublish(normalizePublish(assertPublicPublish(await repository.getPublishById(db, publishId), 'Published episode not found.')));
}

export async function getEpisodeFeed(input: { cursor?: string; itemTypes?: string[]; limit: number }): Promise<FeedResponse> {
  const cursor = input.cursor ? decodeFeedCursor(input.cursor) : undefined;
  const rows = await repository.listFeedItemProjections(db, {
    cursor,
    itemTypes: input.itemTypes,
    limit: input.limit + 1
  });
  const pageRows = rows.slice(0, input.limit);
  const lastRow = pageRows[pageRows.length - 1] ?? null;

  return {
    items: pageRows.map((row) => row.item),
    nextCursor:
      rows.length > input.limit && lastRow
        ? encodeFeedCursor({
            createdAt: lastRow.publishedAt,
            publishId: lastRow.id
          })
        : null
  };
}

function toFeedResponse(rows: Array<{ id: string; publishedAt: string; item: FeedItem }>, limit: number): FeedResponse {
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1] ?? null;

  return {
    items: pageRows.map((row) => row.item),
    nextCursor:
      rows.length > limit && lastRow
        ? encodeFeedCursor({
            createdAt: lastRow.publishedAt,
            publishId: lastRow.id
          })
        : null
  };
}

export async function getFeedHome(): Promise<FeedHomeResponse> {
  const [trendingRows, newRows, recommendedRows, shortsRows] = await Promise.all([
    repository.listFeedItemProjections(db, { limit: 10, orderBy: 'trending' }),
    repository.listFeedItemProjections(db, { limit: 12 }),
    repository.listFeedItemProjections(db, {
      itemTypes: ['promptoon', 'webtoon_episode'],
      limit: 12,
      orderBy: 'trending'
    }),
    repository.listFeedItemProjections(db, { itemTypes: ['short_drama'], limit: 12 })
  ]);

  return {
    hero: trendingRows[0]?.item ?? newRows[0]?.item ?? null,
    sections: [
      {
        key: 'trending',
        title: 'trending TOP 10',
        subtitle: '지금 가장 반응이 좋은 작품',
        items: trendingRows.map((row) => row.item)
      },
      {
        key: 'new',
        title: '신작',
        subtitle: '최근 공개된 에피소드',
        items: newRows.map((row) => row.item)
      },
      {
        key: 'recommended',
        title: '추천',
        subtitle: '선택형 프롬툰과 웹툰 추천',
        items: recommendedRows.map((row) => row.item)
      },
      {
        key: 'shorts',
        title: '숏드라마',
        subtitle: '짧게 시작하는 세로형 콘텐츠',
        items: shortsRows.map((row) => row.item)
      }
    ]
  };
}

export async function searchFeed(input: {
  cursor?: string;
  itemTypes?: string[];
  limit: number;
  query?: string;
}): Promise<FeedResponse> {
  const cursor = input.cursor ? decodeFeedCursor(input.cursor) : undefined;
  const rows = await repository.listFeedItemProjections(db, {
    cursor,
    itemTypes: input.itemTypes,
    limit: input.limit + 1,
    query: input.query
  });

  return toFeedResponse(rows, input.limit);
}

export async function getBookmarkedFeed(input: { cursor?: string; limit: number; userId: string }): Promise<FeedResponse> {
  const cursor = input.cursor ? decodeFeedCursor(input.cursor) : undefined;
  const rows = await repository.listBookmarkedFeedItemProjections(db, {
    cursor,
    limit: input.limit + 1,
    userId: input.userId
  });
  const pageRows = rows.slice(0, input.limit);
  const lastRow = pageRows[pageRows.length - 1] ?? null;

  return {
    items: pageRows.map((row) => row.item),
    nextCursor:
      rows.length > input.limit && lastRow
        ? encodeFeedCursor({
            createdAt: lastRow.cursorAt,
            publishId: lastRow.id
          })
        : null
  };
}

export async function getChannelHome(channelSlug: string): Promise<ChannelHome> {
  const channel = assertExists(await repository.getChannelBySlug(db, channelSlug), 'Channel not found.');
  const projected = await repository.getChannelHomeProjection(db, channel.id);
  if (projected) {
    return projected;
  }

  const rebuilt = assertExists(await repository.buildChannelHomeFromPublicTables(db, channel.id), 'Channel not found.');
  await repository.upsertChannelHomeProjection(db, channel.id, rebuilt);
  return rebuilt;
}

export async function getRelatedShorts(publishId: string): Promise<RelatedShort[]> {
  assertPublicPublish(await repository.getPublishById(db, publishId), 'Published episode not found.');
  return repository.listRelatedShortsForPublish(db, publishId);
}

export async function getCommentsMeta(publishId: string): Promise<CommentsMetaResponse> {
  const promptoonPublish = await repository.getPublishById(db, publishId);
  const movingtoonPublish = promptoonPublish ? null : await repository.getMovingtoonPublishProjectionContext(db, publishId);
  assertExists(promptoonPublish ?? movingtoonPublish, 'Published content not found.');
  const meta = await repository.getCommentsMetaByPublishId(db, publishId);

  return {
    publishId,
    commentCount: meta?.comment_count ?? 0,
    latestCommentAt: meta?.latest_comment_at ? meta.latest_comment_at.toISOString() : null,
    discussionUrl: meta?.discussion_url ?? `/community/publishes/${publishId}`,
    embedUrl: `/community/publishes/${publishId}`,
    managementUrl: `/studio/community/publishes/${publishId}`
  };
}

export async function rebuildChannelProjectionForChannel(
  executor: DbExecutor,
  channelId: string | null | undefined
): Promise<void> {
  if (!channelId) {
    return;
  }

  const home = await repository.buildChannelHomeFromPublicTables(executor, channelId);
  if (home) {
    await repository.upsertChannelHomeProjection(executor, channelId, home);
  }
}

export async function upsertPublishPublicProjections(
  executor: DbExecutor,
  input: {
    publish: Publish;
    channel: FeedProjectionInput['channel'];
    series: FeedProjectionInput['series'];
  }
): Promise<{ feedItemCreated: boolean }> {
  const publish = normalizePublish(input.publish);
  const feedItem = buildFeedItem(publish);
  if (feedItem) {
    await repository.upsertFeedItemProjection(executor, {
      publish,
      feedItem: buildProjectedFeedItem({
        feedItem,
        publish,
        channel: input.channel,
        series: input.series
      }),
      channel: input.channel,
      series: input.series
    });
  } else {
    await repository.deleteFeedItemProjectionForEpisode(executor, publish.episodeId);
  }

  await repository.ensureEpisodeDiscussion(executor, {
    episodeId: publish.episodeId,
    publishId: publish.id
  });
  await rebuildChannelProjectionForChannel(executor, input.channel.id);

  return {
    feedItemCreated: Boolean(feedItem)
  };
}

export async function rebuildPublicProjections(executor: DbExecutor): Promise<RebuildPublicProjectionsResponse> {
  const publishes = await repository.listLatestPublishesForProjectionRebuild(executor);
  const touchedChannelIds = new Set<string>();
  const touchedSeriesIds = new Set<string>();
  let feedItems = 0;
  let discussions = 0;

  for (const rawPublish of publishes) {
    const publish = normalizePublish(rawPublish);
    const project = assertExists(await repository.getProjectById(executor, publish.projectId), 'Project not found.');
    const channel = await repository.ensureDefaultChannelForProject(executor, project, publish.createdBy);
    const series = await repository.ensureDefaultSeriesForProject(executor, {
      project,
      channelId: channel.id
    });

    await repository.updatePublishPublicPlacement(executor, {
      publishId: publish.id,
      channelId: channel.id,
      seriesId: series.id
    });

    const result = await upsertPublishPublicProjections(executor, {
      publish,
      channel,
      series
    });
    if (result.feedItemCreated) {
      feedItems += 1;
    }
    discussions += 1;
    touchedChannelIds.add(channel.id);
    touchedSeriesIds.add(series.id);
  }

  return {
    publishes: publishes.length,
    channels: touchedChannelIds.size,
    series: touchedSeriesIds.size,
    feedItems,
    channelHomes: touchedChannelIds.size,
    discussions
  };
}
