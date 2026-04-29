import type { AnalyticsEpisodeResponse, AnalyticsResetScope, AnalyticsViewGranularity, AnalyticsViewRange, Cut } from '@promptoon/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const PIE_COLORS = ['#7A3040', '#A54E62', '#D97D73', '#E7B97D'];
const GRANULARITY_LABELS: Record<AnalyticsViewGranularity, string> = {
  daily: '일별',
  weekly: '주별',
  monthly: '월별'
};
const PARTIAL_RESET_OPTIONS: Array<{ label: string; scope: Exclude<AnalyticsResetScope, 'all'> }> = [
  { scope: 'views', label: '조회수' },
  { scope: 'choiceStats', label: '선택지 비율' },
  { scope: 'endingDistribution', label: 'Ending Distribution' },
  { scope: 'cutEngagement', label: 'Cut Engagement' },
  { scope: 'feedEntry', label: 'Feed Entry' }
];

function SummaryCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[28px] border border-editor-border bg-editor-panel/85 p-6 shadow-lg shadow-black/15">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </article>
  );
}

function ChartCard({
  actions,
  bodyClassName = 'mt-5 h-[320px]',
  bodyTestId,
  children,
  title
}: {
  actions?: ReactNode;
  bodyClassName?: string;
  bodyTestId?: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-6 shadow-lg shadow-black/15">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-2xl font-semibold text-zinc-50">{title}</p>
        {actions}
      </div>
      <div className={bodyClassName} data-testid={bodyTestId}>{children}</div>
    </article>
  );
}

function formatDurationMs(value: number | undefined): string {
  const durationMs = Number(value ?? 0);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0.0s';
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getResetScopeLabel(scope: AnalyticsResetScope): string {
  if (scope === 'all') {
    return '전체 분석';
  }

  return PARTIAL_RESET_OPTIONS.find((option) => option.scope === scope)?.label ?? scope;
}

function getViewsChartTitle(granularity: AnalyticsViewGranularity): string {
  return `${GRANULARITY_LABELS[granularity]} 조회수`;
}

function formatPeriodLabel(value: string, granularity: AnalyticsViewGranularity): string {
  if (granularity === 'monthly') {
    return value.slice(0, 7);
  }

  return value.slice(5);
}

function ResetButton({
  ariaLabel,
  children,
  disabled,
  onClick
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-medium text-red-100 transition hover:border-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ResetAnalyticsConfirmModal({
  error,
  isResetting,
  onCancel,
  onConfirm,
  scope
}: {
  error: string | null;
  isResetting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  scope: AnalyticsResetScope | null;
}) {
  if (!scope) {
    return null;
  }

  return (
    <div
      aria-labelledby="analytics-reset-confirm-title"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-[28px] border border-editor-border bg-editor-panel p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-semibold text-zinc-50" id="analytics-reset-confirm-title">
              분석 초기화
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {getResetScopeLabel(scope)}
              {' '}
              데이터를 초기화합니다.
            </p>
          </div>
          <button
            className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isResetting}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm leading-6 text-red-100">삭제된 분석 이벤트는 복구할 수 없습니다.</p>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isResetting}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isResetting}
            onClick={onConfirm}
            type="button"
          >
            {isResetting ? '초기화 중...' : '초기화'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsDashboard({
  analytics,
  cuts,
  error,
  isError,
  isLoading,
  isResetting,
  onResetAnalytics,
  onViewGranularityChange,
  onViewRangeChange,
  viewGranularity,
  viewRange
}: {
  analytics: AnalyticsEpisodeResponse | null;
  cuts: Cut[];
  error?: string;
  isError: boolean;
  isLoading: boolean;
  isResetting: boolean;
  onResetAnalytics: (scope: AnalyticsResetScope) => Promise<void>;
  onViewGranularityChange: (granularity: AnalyticsViewGranularity) => void;
  onViewRangeChange: (range: AnalyticsViewRange) => void;
  viewGranularity: AnalyticsViewGranularity;
  viewRange: AnalyticsViewRange;
}) {
  const cutTitleById = new Map(cuts.map((cut) => [cut.id, cut.title]));
  const [selectedResetScope, setSelectedResetScope] = useState<Exclude<AnalyticsResetScope, 'all'>>('views');
  const [pendingResetScope, setPendingResetScope] = useState<AnalyticsResetScope | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  function requestReset(scope: AnalyticsResetScope) {
    setResetError(null);
    setPendingResetScope(scope);
  }

  function handleViewRangeChange(nextRange: AnalyticsViewRange) {
    onViewRangeChange({
      from: nextRange.from || undefined,
      to: nextRange.to || undefined
    });
  }

  async function handleConfirmReset() {
    if (!pendingResetScope) {
      return;
    }

    try {
      await onResetAnalytics(pendingResetScope);
      setPendingResetScope(null);
    } catch (resetFailure) {
      setResetError(resetFailure instanceof Error ? resetFailure.message : '분석 데이터를 초기화하지 못했습니다.');
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-8 text-zinc-300">
        Analytics loading...
      </section>
    );
  }

  if (isError || !analytics) {
    return (
      <section className="rounded-[32px] border border-red-500/20 bg-red-500/10 p-8 text-red-100">
        {error ?? 'Failed to load analytics.'}
      </section>
    );
  }

  const analyticsData = analytics;
  const replayRate = analyticsData.replayRate ?? 0;
  const cutEngagement = analyticsData.cutEngagement ?? [];
  const endingDistribution = analyticsData.endingDistribution ?? [];
  const choiceGroups = Object.entries(analyticsData.choiceStats ?? {}).filter(([, stats]) => stats.length >= 2);
  const maxEndingCount = Math.max(1, ...endingDistribution.map((stat) => stat.count));
  const maxDropOffCount = Math.max(1, ...cutEngagement.map((stat) => stat.dropOffCount));
  const hasData =
    analyticsData.totalViews > 0 ||
    analyticsData.uniqueViewers > 0 ||
    analyticsData.feedEntry.impressions > 0 ||
    analyticsData.feedEntry.choiceClicks > 0 ||
    choiceGroups.length > 0 ||
    cutEngagement.some((stat) => stat.dropOffCount > 0 || stat.avgDurationMs > 0) ||
    endingDistribution.length > 0 ||
    analyticsData.viewsByPeriod.some((period) => period.views > 0 || period.uniqueViewers > 0);
  const dashboardControls = (
    <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-6 shadow-lg shadow-black/15">
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.1fr_1.3fr] xl:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">조회수 단위</p>
          <div className="mt-3 inline-flex rounded-full border border-editor-border bg-black/20 p-1">
            {(Object.keys(GRANULARITY_LABELS) as AnalyticsViewGranularity[]).map((granularity) => (
              <button
                className={[
                  'rounded-full px-4 py-2 text-sm transition',
                  granularity === viewGranularity ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:text-white'
                ].join(' ')}
                key={granularity}
                onClick={() => onViewGranularityChange(granularity)}
                type="button"
              >
                {GRANULARITY_LABELS[granularity]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">조회 기간</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              aria-label="조회 시작일"
              className="min-h-10 min-w-0 rounded-full border border-editor-border bg-[#18181d] px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accent"
              max={viewRange.to}
              onChange={(event) => handleViewRangeChange({ ...viewRange, from: event.target.value })}
              type="date"
              value={viewRange.from ?? ''}
            />
            <input
              aria-label="조회 종료일"
              className="min-h-10 min-w-0 rounded-full border border-editor-border bg-[#18181d] px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accent"
              min={viewRange.from}
              onChange={(event) => handleViewRangeChange({ ...viewRange, to: event.target.value })}
              type="date"
              value={viewRange.to ?? ''}
            />
            <button
              className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!viewRange.from && !viewRange.to}
              onClick={() => handleViewRangeChange({})}
              type="button"
            >
              최근 기간
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">초기화 설정</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <select
              className="min-h-10 rounded-full border border-editor-border bg-[#18181d] px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accent disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isResetting}
              onChange={(event) => setSelectedResetScope(event.target.value as Exclude<AnalyticsResetScope, 'all'>)}
              value={selectedResetScope}
            >
              {PARTIAL_RESET_OPTIONS.map((option) => (
                <option key={option.scope} value={option.scope}>
                  {option.label}
                </option>
              ))}
            </select>
            <ResetButton ariaLabel={`${getResetScopeLabel(selectedResetScope)} 부분 초기화`} disabled={isResetting} onClick={() => requestReset(selectedResetScope)}>
              부분 초기화
            </ResetButton>
            <ResetButton ariaLabel="전체 분석 초기화" disabled={isResetting} onClick={() => requestReset('all')}>
              전체 초기화
            </ResetButton>
          </div>
        </div>
      </div>
    </section>
  );
  const resetConfirmModal = (
    <ResetAnalyticsConfirmModal
      error={resetError}
      isResetting={isResetting}
      onCancel={() => {
        if (!isResetting) {
          setPendingResetScope(null);
          setResetError(null);
        }
      }}
      onConfirm={() => {
        void handleConfirmReset();
      }}
      scope={pendingResetScope}
    />
  );

  if (!hasData) {
    return (
      <section className="grid gap-6">
        {dashboardControls}
        <section className="rounded-[32px] border border-dashed border-editor-border bg-editor-panel/70 p-14 text-center text-zinc-400">
          아직 수집된 데이터가 없습니다.
        </section>
        {resetConfirmModal}
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      {dashboardControls}
      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard label="총 조회수" value={analyticsData.totalViews.toLocaleString()} />
        <SummaryCard label="유니크 시청자" value={analyticsData.uniqueViewers.toLocaleString()} />
        <SummaryCard label="완주율" value={`${analyticsData.completionRate.toFixed(1)}%`} />
        <SummaryCard label="리플레이율" value={`${replayRate.toFixed(1)}%`} />
        <SummaryCard label="피드 진입률" value={`${analyticsData.feedEntry.conversionRate.toFixed(1)}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard title="퍼널 분석">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={analyticsData.funnel}>
              <CartesianGrid stroke="#2A2A30" strokeDasharray="4 4" />
              <XAxis dataKey="label" stroke="#8c8c94" />
              <YAxis allowDecimals={false} stroke="#8c8c94" />
              <Tooltip
                contentStyle={{ background: '#141418', border: '1px solid #2A2A30', borderRadius: 18 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                formatter={(value) => [Number(value ?? 0).toLocaleString(), '시청자']}
              />
              <Bar dataKey="viewers" fill="#7A3040" radius={[14, 14, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={getViewsChartTitle(viewGranularity)}>
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={analyticsData.viewsByPeriod}>
              <CartesianGrid stroke="#2A2A30" strokeDasharray="4 4" />
              <XAxis dataKey="periodStart" stroke="#8c8c94" tickFormatter={(value: string) => formatPeriodLabel(value, viewGranularity)} />
              <YAxis allowDecimals={false} stroke="#8c8c94" />
              <Tooltip
                contentStyle={{ background: '#141418', border: '1px solid #2A2A30', borderRadius: 18 }}
                formatter={(value, name) => [
                  Number(value ?? 0).toLocaleString(),
                  name === 'uniqueViewers' ? '유니크 시청자' : '조회수'
                ]}
                labelFormatter={(label) => `${GRANULARITY_LABELS[viewGranularity]} · ${String(label ?? '')}`}
              />
              <Legend
                formatter={(value) => (value === 'uniqueViewers' ? '유니크 시청자' : '조회수')}
                iconType="circle"
                wrapperStyle={{ color: '#D4D4D8', fontSize: 12 }}
              />
              <Line dataKey="views" dot={{ fill: '#E7B97D', r: 4 }} stroke="#E7B97D" strokeWidth={3} type="monotone" />
              <Line dataKey="uniqueViewers" dot={{ fill: '#38BDF8', r: 4 }} stroke="#38BDF8" strokeWidth={3} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Feed Entry">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="노출" value={analyticsData.feedEntry.impressions.toLocaleString()} />
          <SummaryCard label="선택 클릭" value={analyticsData.feedEntry.choiceClicks.toLocaleString()} />
          <SummaryCard label="전환율" value={`${analyticsData.feedEntry.conversionRate.toFixed(1)}%`} />
        </div>
      </ChartCard>

      {endingDistribution.length > 0 ? (
        <article className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-6 shadow-lg shadow-black/15">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-2xl font-semibold text-zinc-50">Ending Distribution</p>
            <ResetButton
              ariaLabel="Ending Distribution 전체 초기화"
              disabled={isResetting}
              onClick={() => requestReset('endingDistribution')}
            >
              전체 초기화
            </ResetButton>
          </div>
          <div className="mt-5 grid gap-3">
            {endingDistribution.map((stat, index) => (
              <div className="grid gap-2" key={stat.cutId}>
                <div className="flex items-center justify-between gap-4 text-sm text-zinc-300">
                  <span className="truncate">{cutTitleById.get(stat.cutId) ?? stat.cutId}</span>
                  <span className="shrink-0">{stat.count.toLocaleString()} · {stat.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-black/25">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                      width: `${Math.max(4, (stat.count / maxEndingCount) * 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {choiceGroups.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {choiceGroups.map(([cutId, stats], groupIndex) => (
            <ChartCard
              bodyClassName="mt-5 grid gap-4"
              bodyTestId={`choice-stats-card-body-${cutId}`}
              key={cutId}
              title={`선택지 비율 · ${cutTitleById.get(cutId) ?? cutId}`}
            >
              <div className="h-[260px] min-h-0">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={stats}
                      dataKey="count"
                      innerRadius={62}
                      nameKey="label"
                      outerRadius={110}
                      paddingAngle={4}
                    >
                      {stats.map((stat, index) => (
                        <Cell fill={PIE_COLORS[(groupIndex + index) % PIE_COLORS.length]} key={stat.choiceId} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#141418', border: '1px solid #2A2A30', borderRadius: 18 }}
                      formatter={(_value, _name, payload) => {
                        const item = payload?.payload as { count?: number; percentage?: number } | undefined;
                        return item
                          ? [`${Number(item.count ?? 0).toLocaleString()}회 · ${Number(item.percentage ?? 0).toFixed(1)}%`, '선택']
                          : ['0', '선택'];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-2">
                {stats.map((stat, index) => (
                  <div
                    className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-sm text-zinc-300"
                    key={stat.choiceId}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[(groupIndex + index) % PIE_COLORS.length] }}
                      />
                      <span className="truncate">{stat.label}</span>
                    </span>
                    <span className="shrink-0">
                      {stat.count.toLocaleString()} · {stat.percentage.toFixed(1)}% · {formatDurationMs(stat.avgHesitationMs)}
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          ))}
        </div>
      ) : null}

      {cutEngagement.length > 0 ? (
        <article className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-6 shadow-lg shadow-black/15">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-2xl font-semibold text-zinc-50">Cut Engagement</p>
            <ResetButton
              ariaLabel="Cut Engagement 전체 초기화"
              disabled={isResetting}
              onClick={() => requestReset('cutEngagement')}
            >
              전체 초기화
            </ResetButton>
          </div>
          <div className="mt-5 grid gap-3">
            {cutEngagement.map((stat) => (
              <div className="grid gap-2 rounded-2xl border border-editor-border bg-black/10 px-4 py-3" key={stat.cutId}>
                <div className="flex items-center justify-between gap-4 text-sm text-zinc-300">
                  <span className="truncate">{cutTitleById.get(stat.cutId) ?? stat.cutId}</span>
                  <span className="shrink-0">이탈 {stat.dropOffCount.toLocaleString()} · 평균 {formatDurationMs(stat.avgDurationMs)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/25">
                  <div
                    className="h-full rounded-full bg-editor-accent"
                    style={{ width: `${Math.max(stat.dropOffCount > 0 ? 4 : 0, (stat.dropOffCount / maxDropOffCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}
      {resetConfirmModal}
    </section>
  );
}
