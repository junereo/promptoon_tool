import { ArrowLeftLg as ArrowLeft, ChartBarVertical01 as BarChart3 } from 'react-coolicons';
import { Link, useParams } from 'react-router-dom';

import { useProjectAnalytics } from '../../../features/analytics/hooks/use-project-analytics';

export function StudioAnalyticsPage() {
  const { projectId } = useParams();
  const analyticsQuery = useProjectAnalytics(projectId);
  const analytics = analyticsQuery.data ?? null;

  if (analyticsQuery.isLoading) {
    return <main className="p-8 text-zinc-300">분석 요약을 불러오고 있습니다.</main>;
  }

  if (analyticsQuery.isError || !analytics) {
    return <main className="p-8 text-red-200">프로젝트를 찾을 수 없습니다.</main>;
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${analytics.projectId}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Analytics</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-zinc-50">{analytics.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          프로젝트 단위 시청, 피드 진입, 발행 요약입니다. 상세 지표는 각 에피소드 편집기의 분석 탭에서 확인합니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="전체 에피소드" value={`${analytics.totalEpisodes}`} />
        <Metric label="발행 에피소드" value={`${analytics.publishedEpisodes}`} />
        <Metric label="발행 버전" value={`${analytics.totalPublishes}`} />
        <Metric label="조회수" value={analytics.totalViews.toLocaleString()} />
        <Metric label="유니크 시청자" value={analytics.uniqueViewers.toLocaleString()} />
        <Metric label="완주율" value={`${analytics.completionRate.toFixed(1)}%`} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="피드 노출" value={analytics.feedImpressions.toLocaleString()} />
        <Metric label="엔딩 도달" value={analytics.endingReaches.toLocaleString()} />
        <Metric label="최근 발행" value={analytics.latestPublishedAt ? formatDate(analytics.latestPublishedAt) : '-'} />
      </section>

      <section className="grid gap-3">
        {analytics.episodes.map((episode) => (
          <Link
            className="flex items-center justify-between gap-4 rounded-[24px] border border-editor-border bg-editor-panel/75 p-5 transition hover:border-editor-accentSoft"
            key={episode.episodeId}
            to={`/studio/projects/${analytics.projectId}/episodes/${episode.episodeId}?tab=analytics`}
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-100">
                EP.{episode.episodeNo} {episode.title}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                상태: {episode.status} · 조회 {episode.totalViews.toLocaleString()} · 발행 {episode.publishCount}
              </p>
            </div>
            <BarChart3 className="h-5 w-5 shrink-0 text-editor-accentSoft" />
          </Link>
        ))}
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-zinc-50">{value}</p>
    </article>
  );
}
