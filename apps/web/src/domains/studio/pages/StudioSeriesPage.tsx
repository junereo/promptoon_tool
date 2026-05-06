import { ArrowLeftLg as ArrowLeft, EditPencilLine01 as SquarePen } from 'react-coolicons';
import { Link, useParams } from 'react-router-dom';

import { useProjects } from '../../../features/project/hooks/use-project-query';

export function StudioSeriesPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;

  if (projectsQuery.isLoading) {
    return <main className="p-8 text-zinc-300">시리즈 정보를 불러오고 있습니다.</main>;
  }

  if (projectsQuery.isError || !project) {
    return <main className="p-8 text-red-200">프로젝트를 찾을 수 없습니다.</main>;
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${project.id}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Series</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-zinc-50">{project.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          현재 MVP에서는 프로젝트가 기본 시리즈 역할을 하며, 에피소드 발행 시 기본 채널/시리즈 projection에 연결됩니다.
        </p>
      </section>

      <section className="grid gap-3">
        {project.episodes.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-editor-border bg-black/10 p-8 text-zinc-500">
            시리즈에 표시할 에피소드가 없습니다.
          </div>
        ) : (
          project.episodes.map((episode) => (
            <Link
              className="flex items-center justify-between gap-4 rounded-[24px] border border-editor-border bg-editor-panel/75 p-4 transition hover:border-editor-accentSoft"
              key={episode.id}
              to={`/studio/projects/${project.id}/episodes/${episode.id}`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-100">
                  EP.{episode.episodeNo} {episode.title}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{episode.status}</p>
              </div>
              <SquarePen className="h-5 w-5 shrink-0 text-zinc-400" />
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
