import type { AnalyticsEpisodeResponse, Cut } from '@promptoon/shared';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <article className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-6 shadow-lg shadow-black/15">
      <p className="font-display text-2xl font-semibold text-zinc-50">{title}</p>
      <div className="mt-5 h-[320px]">{children}</div>
    </article>
  );
}

export function AnalyticsDashboard({
  analytics,
  cuts,
  error,
  isError,
  isLoading
}: {
  analytics: AnalyticsEpisodeResponse | null;
  cuts: Cut[];
  error?: string;
  isError: boolean;
  isLoading: boolean;
}) {
  const cutTitleById = new Map(cuts.map((cut) => [cut.id, cut.title]));

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
  const choiceGroups = Object.entries(analyticsData.choiceStats).filter(([, stats]) => stats.length > 0);
  const hasData =
    analyticsData.totalViews > 0 ||
    analyticsData.uniqueViewers > 0 ||
    analyticsData.feedEntry.impressions > 0 ||
    analyticsData.feedEntry.choiceClicks > 0 ||
    choiceGroups.length > 0 ||
    analyticsData.dailyViews.some((day) => day.views > 0);

  if (!hasData) {
    return (
      <section className="rounded-[32px] border border-dashed border-editor-border bg-editor-panel/70 p-14 text-center text-zinc-400">
        아직 수집된 데이터가 없습니다.
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="총 조회수" value={analyticsData.totalViews.toLocaleString()} />
        <SummaryCard label="유니크 시청자" value={analyticsData.uniqueViewers.toLocaleString()} />
        <SummaryCard label="완주율" value={`${analyticsData.completionRate.toFixed(1)}%`} />
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

        <ChartCard title="일별 조회수">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={analyticsData.dailyViews}>
              <CartesianGrid stroke="#2A2A30" strokeDasharray="4 4" />
              <XAxis dataKey="date" stroke="#8c8c94" tickFormatter={(value: string) => value.slice(5)} />
              <YAxis allowDecimals={false} stroke="#8c8c94" />
              <Tooltip
                contentStyle={{ background: '#141418', border: '1px solid #2A2A30', borderRadius: 18 }}
                formatter={(value) => [Number(value ?? 0).toLocaleString(), '조회']}
                labelFormatter={(label) => String(label ?? '')}
              />
              <Line dataKey="views" dot={{ fill: '#E7B97D', r: 4 }} stroke="#E7B97D" strokeWidth={3} type="monotone" />
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

      {choiceGroups.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {choiceGroups.map(([cutId, stats], groupIndex) => (
            <ChartCard key={cutId} title={`선택지 비율 · ${cutTitleById.get(cutId) ?? cutId}`}>
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

              <div className="mt-4 grid gap-2">
                {stats.map((stat, index) => (
                  <div
                    className="flex items-center justify-between rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-sm text-zinc-300"
                    key={stat.choiceId}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[(groupIndex + index) % PIE_COLORS.length] }}
                      />
                      {stat.label}
                    </span>
                    <span>{stat.count.toLocaleString()} · {stat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          ))}
        </div>
      ) : null}
    </section>
  );
}
