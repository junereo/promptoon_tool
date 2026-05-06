import { ArrowLeftLg as ArrowLeft, ExternalLink } from 'react-coolicons';
import { Link, useParams } from 'react-router-dom';

import { useProjectPublishHistory, useProjects } from '../../../features/project/hooks/use-project-query';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function StudioPublishHistoryPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const historyQuery = useProjectPublishHistory(projectId);
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;

  if (projectsQuery.isLoading || historyQuery.isLoading) {
    return <main className="p-8 text-zinc-300">발행 이력을 불러오고 있습니다.</main>;
  }

  if (projectsQuery.isError || historyQuery.isError || !project) {
    return <main className="p-8 text-red-200">발행 이력을 불러올 수 없습니다.</main>;
  }

  const publishes = historyQuery.data?.publishes ?? [];

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${project.id}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Publish History</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{project.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">발행본 버전, 공개 Viewer 진입점, projection 연결 상태를 확인합니다.</p>
      </section>

      <section className="grid gap-3">
        {publishes.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-editor-border bg-black/10 p-8 text-zinc-500">
            아직 발행 이력이 없습니다.
          </div>
        ) : (
          publishes.map((publish) => (
            <article className="rounded-[24px] border border-editor-border bg-editor-panel/75 p-5" key={publish.publishId}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-100">
                    EP.{publish.episodeNo} {publish.episodeTitle}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    v{publish.versionNo} · {formatDate(publish.createdAt)}
                  </p>
                </div>
                <Link
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-editor-accentSoft"
                  to={`/v/${publish.publishId}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  Viewer
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
