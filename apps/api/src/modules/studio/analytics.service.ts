import type {
  AnalyticsChoiceStat,
  AnalyticsEpisodeResponse,
  AnalyticsViewGranularity,
  AnalyticsViewPoint,
  AnalyticsViewRange,
  Choice,
  EpisodeDraftResponse,
  ProjectAnalyticsResponse,
  ResetEpisodeAnalyticsRequest
} from '@promptoon/shared';

import { db } from '../../db';
import * as editorRepository from '../promptoon-core/editor.repository';
import * as repository from './analytics.repository';
import * as authorizationService from './authorization.service';

function getStartCutId(draft: EpisodeDraftResponse): string | null {
  return draft.episode.startCutId ?? draft.cuts.find((cut) => cut.isStart)?.id ?? draft.cuts[0]?.id ?? null;
}

function getUtcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getUtcIsoWeekStart(date: Date): Date {
  const start = getUtcStartOfDay(date);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseAnalyticsDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function getUtcPeriodStart(date: Date, granularity: AnalyticsViewGranularity): Date {
  if (granularity === 'weekly') {
    return getUtcIsoWeekStart(date);
  }

  if (granularity === 'monthly') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  return getUtcStartOfDay(date);
}

function addAnalyticsPeriod(date: Date, granularity: AnalyticsViewGranularity, amount: number): Date {
  const result = new Date(date.getTime());

  if (granularity === 'monthly') {
    result.setUTCMonth(result.getUTCMonth() + amount, 1);
  } else {
    result.setUTCDate(result.getUTCDate() + (granularity === 'weekly' ? amount * 7 : amount));
  }

  return result;
}

function getDefaultAnalyticsPeriodStarts(granularity: AnalyticsViewGranularity, referenceDate = new Date()): string[] {
  const periodCount = granularity === 'daily' ? 14 : 12;
  const anchor = getUtcPeriodStart(referenceDate, granularity);
  const result: string[] = [];

  for (let index = periodCount - 1; index >= 0; index -= 1) {
    result.push(formatUtcDate(addAnalyticsPeriod(anchor, granularity, -index)));
  }

  return result;
}

function getAnalyticsViewWindow(
  granularity: AnalyticsViewGranularity,
  range?: AnalyticsViewRange
): { periodStarts: string[]; fromDate: string; toDate?: string } {
  const defaultStarts = getDefaultAnalyticsPeriodStarts(granularity);
  const hasRange = Boolean(range?.from || range?.to);

  if (!hasRange) {
    return {
      periodStarts: defaultStarts,
      fromDate: `${defaultStarts[0] ?? formatUtcDate(getUtcStartOfDay(new Date()))}T00:00:00.000Z`
    };
  }

  const today = formatUtcDate(getUtcStartOfDay(new Date()));
  if (range?.to && !range?.from) {
    const periodStarts = getDefaultAnalyticsPeriodStarts(granularity, parseAnalyticsDate(range.to));

    return {
      periodStarts,
      fromDate: `${periodStarts[0] ?? range.to}T00:00:00.000Z`,
      toDate: addAnalyticsPeriod(parseAnalyticsDate(range.to), 'daily', 1).toISOString()
    };
  }

  const fromDateValue = range?.from ?? defaultStarts[0] ?? today;
  const toDateValue = range?.to ?? (range?.from && range.from > today ? range.from : today);
  const start = getUtcPeriodStart(parseAnalyticsDate(fromDateValue), granularity);
  const end = getUtcPeriodStart(parseAnalyticsDate(toDateValue), granularity);
  const periodStarts: string[] = [];

  for (let date = start; date.getTime() <= end.getTime(); date = addAnalyticsPeriod(date, granularity, 1)) {
    periodStarts.push(formatUtcDate(date));
  }

  return {
    periodStarts,
    fromDate: `${fromDateValue}T00:00:00.000Z`,
    toDate: addAnalyticsPeriod(parseAnalyticsDate(toDateValue), 'daily', 1).toISOString()
  };
}

function fillViewsByPeriod(rows: AnalyticsViewPoint[], periodStarts: string[]): AnalyticsViewPoint[] {
  const byPeriodStart = new Map(rows.map((row) => [row.periodStart, row]));

  return periodStarts.map((periodStart) => ({
    periodStart,
    views: byPeriodStart.get(periodStart)?.views ?? 0,
    uniqueViewers: byPeriodStart.get(periodStart)?.uniqueViewers ?? 0
  }));
}

function buildChoiceStats(
  draft: EpisodeDraftResponse,
  clickedStats: Map<string, AnalyticsChoiceStat[]>
): Record<string, AnalyticsChoiceStat[]> {
  const result: Record<string, AnalyticsChoiceStat[]> = {};

  const choicesByCutId = new Map<string, Choice[]>();
  for (const choice of draft.choices) {
    const list = choicesByCutId.get(choice.cutId) ?? [];
    list.push(choice);
    choicesByCutId.set(choice.cutId, list);
  }

  for (const [cutId, choices] of choicesByCutId.entries()) {
    const clickedByChoiceId = new Map((clickedStats.get(cutId) ?? []).map((stat) => [stat.choiceId, stat]));
    const merged = choices
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((choice) => {
        const clickedStat = clickedByChoiceId.get(choice.id);

        return {
          choiceId: choice.id,
          label: choice.label,
          count: clickedStat?.count ?? 0,
          percentage: 0,
          ...(clickedStat?.avgHesitationMs === undefined ? {} : { avgHesitationMs: clickedStat.avgHesitationMs })
        };
      });
    const total = merged.reduce((sum, stat) => sum + stat.count, 0);

    result[cutId] = merged.map((stat) => ({
      ...stat,
      percentage: total === 0 ? 0 : Number(((stat.count / total) * 100).toFixed(1))
    }));
  }

  return result;
}

export async function getProjectAnalytics(projectId: string, userId: string): Promise<ProjectAnalyticsResponse> {
  await authorizationService.ensureProjectReadableByUser(projectId, userId);
  return repository.getProjectAnalytics(db, projectId);
}

export async function getEpisodeAnalytics(
  episodeId: string,
  userId: string,
  viewsGranularity: AnalyticsViewGranularity = 'daily',
  viewsRange?: AnalyticsViewRange
): Promise<AnalyticsEpisodeResponse> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_READ_ROLES);
  const draft = authorizationService.assertExists(await editorRepository.getEpisodeDraft(db, episodeId), 'Episode not found.');
  const startCutId = getStartCutId(draft);
  const viewWindow = getAnalyticsViewWindow(viewsGranularity, viewsRange);

  const [
    choiceEngaged,
    endingReached,
    choiceStatsMap,
    cutEngagementMap,
    endingDistribution,
    replayViewers,
    rawViewsByPeriod,
    totalViews,
    uniqueViewers,
    feedImpressions,
    feedChoiceClicks
  ] = await Promise.all([
    repository.countViewerEvents(db, { episodeId, eventType: 'choice_click', distinctAnonymous: true }),
    repository.countViewerEvents(db, { episodeId, eventType: 'ending_reach', distinctAnonymous: true }),
    repository.getChoiceClickStats(db, episodeId),
    repository.getCutEngagementStats(db, episodeId),
    repository.getEndingDistributionStats(db, episodeId),
    startCutId ? repository.countReplayViewers(db, { episodeId, startCutId }) : Promise.resolve(0),
    startCutId
      ? repository.getStartViewsByPeriod(db, {
          episodeId,
          startCutId,
          granularity: viewsGranularity,
          fromDate: viewWindow.fromDate,
          toDate: viewWindow.toDate
        })
      : Promise.resolve([]),
    startCutId ? repository.countViewerEvents(db, { episodeId, eventType: 'cut_view', cutId: startCutId }) : Promise.resolve(0),
    startCutId
      ? repository.countViewerEvents(db, { episodeId, eventType: 'cut_view', cutId: startCutId, distinctAnonymous: true })
      : Promise.resolve(0),
    repository.countViewerEvents(db, { episodeId, eventType: 'feed_impression' }),
    repository.countViewerEvents(db, { episodeId, eventType: 'feed_choice_click' })
  ]);

  return {
    totalViews,
    uniqueViewers,
    completionRate: uniqueViewers === 0 ? 0 : Number(((endingReached / uniqueViewers) * 100).toFixed(1)),
    replayRate: uniqueViewers === 0 ? 0 : Number(((replayViewers / uniqueViewers) * 100).toFixed(1)),
    funnel: [
      { key: 'start_view', label: '시작', viewers: uniqueViewers },
      { key: 'choice_engaged', label: '선택', viewers: choiceEngaged },
      { key: 'ending_reached', label: '엔딩', viewers: endingReached }
    ],
    cutEngagement: draft.cuts.map((cut) => ({
      cutId: cut.id,
      dropOffCount: cutEngagementMap.get(cut.id)?.dropOffCount ?? 0,
      avgDurationMs: cutEngagementMap.get(cut.id)?.avgDurationMs ?? 0
    })),
    choiceStats: buildChoiceStats(draft, choiceStatsMap),
    endingDistribution,
    viewGranularity: viewsGranularity,
    viewsByPeriod: fillViewsByPeriod(rawViewsByPeriod, viewWindow.periodStarts),
    feedEntry: {
      impressions: feedImpressions,
      choiceClicks: feedChoiceClicks,
      conversionRate: feedImpressions === 0 ? 0 : Number(((feedChoiceClicks / feedImpressions) * 100).toFixed(1))
    }
  };
}

export async function resetEpisodeAnalytics(
  episodeId: string,
  userId: string,
  request: ResetEpisodeAnalyticsRequest
): Promise<void> {
  await authorizationService.ensureEpisodeProjectRole(episodeId, userId, authorizationService.PROJECT_PUBLISH_ROLES);
  const draft = request.scope === 'views'
    ? authorizationService.assertExists(await editorRepository.getEpisodeDraft(db, episodeId), 'Episode not found.')
    : null;

  await repository.deleteViewerEventsForAnalyticsScope(db, {
    episodeId,
    scope: request.scope,
    startCutId: draft ? getStartCutId(draft) : null
  });
}
