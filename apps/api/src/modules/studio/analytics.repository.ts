import type {
  AnalyticsChoiceStat,
  AnalyticsCutEngagement,
  AnalyticsEndingStat,
  AnalyticsResetScope,
  AnalyticsViewGranularity,
  AnalyticsViewPoint,
  ProjectAnalyticsEpisodeSummary,
  ProjectAnalyticsResponse,
  TelemetryEventType
} from '@promptoon/shared';

import type { DbExecutor } from '../../db';

type ProjectAnalyticsRow = {
  project_id: string;
  title: string;
  status: 'draft' | 'published';
  total_episodes: string;
  published_episodes: string;
  draft_episodes: string;
  total_publishes: string;
  total_views: string;
  unique_viewers: string;
  feed_impressions: string;
  ending_reaches: string;
  latest_published_at: Date | null;
};

type ProjectAnalyticsEpisodeRow = {
  episode_id: string;
  title: string;
  episode_no: number;
  status: 'draft' | 'published';
  publish_count: string;
  total_views: string;
  unique_viewers: string;
  ending_reaches: string;
  latest_published_at: Date | null;
};

type ViewerEventCountRow = {
  count: string;
};

type ViewsByPeriodRow = {
  period_start: string;
  views: string;
  unique_viewers: string;
};

type ChoiceStatRow = {
  cut_id: string;
  choice_id: string;
  label: string;
  count: string;
  avg_hesitation_ms: string | null;
};

type CutEngagementRow = {
  cut_id: string;
  drop_off_count: string | null;
  avg_duration_ms: string | null;
};

type EndingStatRow = {
  cut_id: string;
  count: string;
};

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function mapEpisodeSummary(row: ProjectAnalyticsEpisodeRow): ProjectAnalyticsEpisodeSummary {
  return {
    episodeId: row.episode_id,
    title: row.title,
    episodeNo: row.episode_no,
    status: row.status,
    publishCount: toNumber(row.publish_count),
    totalViews: toNumber(row.total_views),
    uniqueViewers: toNumber(row.unique_viewers),
    endingReaches: toNumber(row.ending_reaches),
    latestPublishedAt: toIsoString(row.latest_published_at)
  };
}

function getAnalyticsDateTruncUnit(granularity: AnalyticsViewGranularity): 'day' | 'week' | 'month' {
  if (granularity === 'weekly') {
    return 'week';
  }

  if (granularity === 'monthly') {
    return 'month';
  }

  return 'day';
}

export async function getProjectAnalytics(db: DbExecutor, projectId: string): Promise<ProjectAnalyticsResponse> {
  const [projectResult, episodesResult] = await Promise.all([
    db.query<ProjectAnalyticsRow>(
      `SELECT
         project.id::text AS project_id,
         project.title,
         project.status,
         (SELECT COUNT(*)::text FROM promptoon_episode WHERE project_id = project.id) AS total_episodes,
         (SELECT COUNT(*)::text FROM promptoon_episode WHERE project_id = project.id AND status = 'published') AS published_episodes,
         (SELECT COUNT(*)::text FROM promptoon_episode WHERE project_id = project.id AND status = 'draft') AS draft_episodes,
         (SELECT COUNT(*)::text FROM promptoon_publish WHERE project_id = project.id) AS total_publishes,
         (
           SELECT COUNT(*)::text
           FROM promptoon_viewer_event AS event
           INNER JOIN promptoon_episode AS episode ON episode.id = event.episode_id
           WHERE episode.project_id = project.id
             AND event.event_type = 'cut_view'
         ) AS total_views,
         (
           SELECT COUNT(DISTINCT event.anonymous_id)::text
           FROM promptoon_viewer_event AS event
           INNER JOIN promptoon_episode AS episode ON episode.id = event.episode_id
           WHERE episode.project_id = project.id
             AND event.event_type = 'cut_view'
         ) AS unique_viewers,
         (
           SELECT COUNT(*)::text
           FROM promptoon_viewer_event AS event
           INNER JOIN promptoon_episode AS episode ON episode.id = event.episode_id
           WHERE episode.project_id = project.id
             AND event.event_type = 'feed_impression'
         ) AS feed_impressions,
         (
           SELECT COUNT(*)::text
           FROM promptoon_viewer_event AS event
           INNER JOIN promptoon_episode AS episode ON episode.id = event.episode_id
           WHERE episode.project_id = project.id
             AND event.event_type = 'ending_reach'
         ) AS ending_reaches,
         (SELECT MAX(created_at) FROM promptoon_publish WHERE project_id = project.id) AS latest_published_at
       FROM promptoon_project AS project
       WHERE project.id = $1`,
      [projectId]
    ),
    db.query<ProjectAnalyticsEpisodeRow>(
      `WITH publish_stats AS (
         SELECT
           episode_id,
           COUNT(*)::text AS publish_count,
           MAX(created_at) AS latest_published_at
         FROM promptoon_publish
         GROUP BY episode_id
       ),
       event_stats AS (
         SELECT
           episode_id,
           COUNT(*) FILTER (WHERE event_type = 'cut_view')::text AS total_views,
           COUNT(DISTINCT anonymous_id) FILTER (WHERE event_type = 'cut_view')::text AS unique_viewers,
           COUNT(*) FILTER (WHERE event_type = 'ending_reach')::text AS ending_reaches
         FROM promptoon_viewer_event
         GROUP BY episode_id
       )
       SELECT
         episode.id::text AS episode_id,
         episode.title,
         episode.episode_no,
         episode.status,
         COALESCE(publish_stats.publish_count, '0') AS publish_count,
         COALESCE(event_stats.total_views, '0') AS total_views,
         COALESCE(event_stats.unique_viewers, '0') AS unique_viewers,
         COALESCE(event_stats.ending_reaches, '0') AS ending_reaches,
         publish_stats.latest_published_at
       FROM promptoon_episode AS episode
       LEFT JOIN publish_stats ON publish_stats.episode_id = episode.id
       LEFT JOIN event_stats ON event_stats.episode_id = episode.id
       WHERE episode.project_id = $1
       ORDER BY episode.episode_no ASC, episode.created_at ASC`,
      [projectId]
    )
  ]);

  const row = projectResult.rows[0];
  const uniqueViewers = toNumber(row.unique_viewers);
  const endingReaches = toNumber(row.ending_reaches);

  return {
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    totalEpisodes: toNumber(row.total_episodes),
    publishedEpisodes: toNumber(row.published_episodes),
    draftEpisodes: toNumber(row.draft_episodes),
    totalPublishes: toNumber(row.total_publishes),
    totalViews: toNumber(row.total_views),
    uniqueViewers,
    feedImpressions: toNumber(row.feed_impressions),
    endingReaches,
    completionRate: uniqueViewers === 0 ? 0 : Number(((endingReaches / uniqueViewers) * 100).toFixed(1)),
    latestPublishedAt: toIsoString(row.latest_published_at),
    episodes: episodesResult.rows.map(mapEpisodeSummary)
  };
}

export async function countViewerEvents(
  db: DbExecutor,
  input: {
    episodeId: string;
    eventType: TelemetryEventType;
    cutId?: string;
    distinctAnonymous?: boolean;
  }
): Promise<number> {
  const clauses = ['episode_id = $1', 'event_type = $2'];
  const values: unknown[] = [input.episodeId, input.eventType];

  if (input.cutId) {
    clauses.push(`cut_id = $${values.length + 1}`);
    values.push(input.cutId);
  }

  const result = await db.query<ViewerEventCountRow>(
    `SELECT COUNT(${input.distinctAnonymous ? 'DISTINCT anonymous_id' : '*'})::text AS count
     FROM promptoon_viewer_event
     WHERE ${clauses.join(' AND ')}`,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function getChoiceClickStats(db: DbExecutor, episodeId: string): Promise<Map<string, AnalyticsChoiceStat[]>> {
  const result = await db.query<ChoiceStatRow>(
    `SELECT
       event.cut_id,
       event.choice_id,
       choice.label,
       COUNT(*)::text AS count,
       ROUND(AVG(event.duration_ms))::text AS avg_hesitation_ms
     FROM promptoon_viewer_event AS event
     INNER JOIN promptoon_choice AS choice ON choice.id = event.choice_id
     WHERE event.episode_id = $1
       AND event.event_type = 'choice_click'
       AND event.choice_id IS NOT NULL
     GROUP BY event.cut_id, event.choice_id, choice.label
     ORDER BY event.cut_id ASC, count DESC, choice.label ASC`,
    [episodeId]
  );

  const grouped = new Map<string, AnalyticsChoiceStat[]>();

  for (const row of result.rows) {
    const list = grouped.get(row.cut_id) ?? [];
    list.push({
      choiceId: row.choice_id,
      label: row.label,
      count: Number(row.count),
      percentage: 0,
      avgHesitationMs: row.avg_hesitation_ms === null ? undefined : Number(row.avg_hesitation_ms)
    });
    grouped.set(row.cut_id, list);
  }

  for (const [cutId, stats] of grouped.entries()) {
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    grouped.set(
      cutId,
      stats.map((stat) => ({
        ...stat,
        percentage: total === 0 ? 0 : Number(((stat.count / total) * 100).toFixed(1))
      }))
    );
  }

  return grouped;
}

export async function getCutEngagementStats(db: DbExecutor, episodeId: string): Promise<Map<string, AnalyticsCutEngagement>> {
  const result = await db.query<CutEngagementRow>(
    `WITH cut_durations AS (
       SELECT
         cut_id,
         ROUND(AVG(duration_ms))::text AS avg_duration_ms
       FROM promptoon_viewer_event
       WHERE episode_id = $1
         AND event_type = 'cut_leave'
         AND duration_ms IS NOT NULL
       GROUP BY cut_id
     ),
     cut_dropoffs AS (
       SELECT
         viewed.cut_id,
         COUNT(*)::text AS drop_off_count
       FROM promptoon_viewer_event AS viewed
       WHERE viewed.episode_id = $1
         AND viewed.event_type = 'cut_view'
         AND viewed.session_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM promptoon_viewer_event AS next_event
           WHERE next_event.episode_id = viewed.episode_id
             AND next_event.session_id = viewed.session_id
             AND next_event.created_at > viewed.created_at
             AND next_event.event_type IN ('cut_view', 'choice_click', 'ending_reach')
         )
       GROUP BY viewed.cut_id
     )
     SELECT
       COALESCE(cut_durations.cut_id, cut_dropoffs.cut_id) AS cut_id,
       cut_dropoffs.drop_off_count,
       cut_durations.avg_duration_ms
     FROM cut_durations
     FULL OUTER JOIN cut_dropoffs ON cut_dropoffs.cut_id = cut_durations.cut_id`,
    [episodeId]
  );

  return new Map(
    result.rows.map((row) => [
      row.cut_id,
      {
        cutId: row.cut_id,
        dropOffCount: Number(row.drop_off_count ?? 0),
        avgDurationMs: Number(row.avg_duration_ms ?? 0)
      }
    ])
  );
}

export async function getEndingDistributionStats(db: DbExecutor, episodeId: string): Promise<AnalyticsEndingStat[]> {
  const result = await db.query<EndingStatRow>(
    `SELECT
       cut_id,
       COUNT(*)::text AS count
     FROM promptoon_viewer_event
     WHERE episode_id = $1
       AND event_type = 'ending_reach'
     GROUP BY cut_id
     ORDER BY count DESC, cut_id ASC`,
    [episodeId]
  );
  const total = result.rows.reduce((sum, row) => sum + Number(row.count), 0);

  return result.rows.map((row) => ({
    cutId: row.cut_id,
    count: Number(row.count),
    percentage: total === 0 ? 0 : Number(((Number(row.count) / total) * 100).toFixed(1))
  }));
}

export async function countReplayViewers(db: DbExecutor, input: { episodeId: string; startCutId: string }): Promise<number> {
  const result = await db.query<ViewerEventCountRow>(
    `SELECT COUNT(DISTINCT replay_start.anonymous_id)::text AS count
     FROM promptoon_viewer_event AS replay_start
     WHERE replay_start.episode_id = $1
       AND replay_start.event_type = 'cut_view'
       AND replay_start.cut_id = $2
       AND replay_start.session_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM promptoon_viewer_event AS prior_ending
         WHERE prior_ending.episode_id = replay_start.episode_id
           AND prior_ending.anonymous_id = replay_start.anonymous_id
           AND prior_ending.event_type = 'ending_reach'
           AND prior_ending.session_id IS NOT NULL
           AND prior_ending.session_id <> replay_start.session_id
           AND prior_ending.created_at < replay_start.created_at
       )`,
    [input.episodeId, input.startCutId]
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function getStartViewsByPeriod(
  db: DbExecutor,
  input: { episodeId: string; startCutId: string; granularity: AnalyticsViewGranularity; fromDate: string; toDate?: string | null }
): Promise<AnalyticsViewPoint[]> {
  const truncUnit = getAnalyticsDateTruncUnit(input.granularity);
  const result = await db.query<ViewsByPeriodRow>(
    `SELECT
       TO_CHAR(DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS period_start,
       COUNT(*)::text AS views,
       COUNT(DISTINCT anonymous_id)::text AS unique_viewers
     FROM promptoon_viewer_event
     WHERE episode_id = $1
       AND event_type = 'cut_view'
       AND cut_id = $2
       AND created_at >= $3::timestamptz
       AND ($4::timestamptz IS NULL OR created_at < $4::timestamptz)
     GROUP BY DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'UTC')
     ORDER BY DATE_TRUNC('${truncUnit}', created_at AT TIME ZONE 'UTC') ASC`,
    [input.episodeId, input.startCutId, input.fromDate, input.toDate ?? null]
  );

  return result.rows.map((row) => ({
    periodStart: row.period_start,
    views: Number(row.views),
    uniqueViewers: Number(row.unique_viewers)
  }));
}

export async function deleteViewerEventsForAnalyticsScope(
  db: DbExecutor,
  input: { episodeId: string; scope: AnalyticsResetScope; startCutId?: string | null }
): Promise<number> {
  const values: unknown[] = [input.episodeId];
  let filter = '';

  switch (input.scope) {
    case 'all':
      break;
    case 'views':
      if (!input.startCutId) {
        return 0;
      }
      values.push(input.startCutId);
      filter = ` AND event_type = 'cut_view' AND cut_id = $${values.length}`;
      break;
    case 'choiceStats':
      filter = " AND event_type = 'choice_click'";
      break;
    case 'endingDistribution':
      filter = " AND event_type = 'ending_reach'";
      break;
    case 'cutEngagement':
      filter = " AND event_type IN ('cut_view', 'cut_leave')";
      break;
    case 'feedEntry':
      filter = " AND event_type IN ('feed_impression', 'feed_choice_click')";
      break;
    default:
      return 0;
  }

  const result = await db.query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM promptoon_viewer_event
       WHERE episode_id = $1${filter}
       RETURNING 1
     )
     SELECT COUNT(*)::text AS count FROM deleted`,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
}
