import { ArrowLeft, Eye, Rocket, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  usePublishEpisode,
  useUnpublishEpisode,
  useUpdatePublishedEpisode
} from '../../../features/editor/hooks/use-episode-query';
import { useProjects } from '../../../features/project/hooks/use-project-query';

export function StudioPublishPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const publishEpisode = usePublishEpisode();
  const updatePublishedEpisode = useUpdatePublishedEpisode();
  const unpublishEpisode = useUnpublishEpisode();
  const [notice, setNotice] = useState<string | null>(null);
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;

  async function runPublishAction(action: 'publish' | 'update' | 'unpublish', episodeId: string) {
    if (!projectId) {
      return;
    }

    setNotice(null);
    if (action === 'publish') {
      await publishEpisode.mutateAsync({ projectId, episodeId });
      setNotice('에피소드가 발행되었습니다.');
      return;
    }
    if (action === 'update') {
      await updatePublishedEpisode.mutateAsync({ projectId, episodeId });
      setNotice('발행본이 업데이트되었습니다.');
      return;
    }
    await unpublishEpisode.mutateAsync({ projectId, episodeId });
    setNotice('에피소드가 비공개 처리되었습니다.');
  }

  if (projectsQuery.isLoading) {
    return <main className="p-8 text-zinc-300">발행 상태를 불러오고 있습니다.</main>;
  }

  if (projectsQuery.isError || !project || !projectId) {
    return <main className="p-8 text-red-200">프로젝트를 찾을 수 없습니다.</main>;
  }

  const isMutating = publishEpisode.isPending || updatePublishedEpisode.isPending || unpublishEpisode.isPending;

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${project.id}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Publish</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-zinc-50">{project.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          발행은 PublishManifest, FeedItem projection, ChannelHome projection, discussion meta를 함께 갱신합니다.
        </p>
        {notice ? <p className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p> : null}
      </section>

      <section className="grid gap-3">
        {project.episodes.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-editor-border bg-black/10 p-8 text-zinc-500">
            발행할 에피소드가 없습니다.
          </div>
        ) : (
          project.episodes.map((episode) => (
            <article className="rounded-[24px] border border-editor-border bg-editor-panel/75 p-5" key={episode.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-100">
                    EP.{episode.episodeNo} {episode.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">상태: {episode.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center gap-2 rounded-xl border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                    to={`/studio/projects/${project.id}/episodes/${episode.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    편집기
                  </Link>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-editor-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-editor-accentSoft disabled:opacity-60"
                    disabled={isMutating}
                    onClick={() => {
                      void runPublishAction(episode.status === 'published' ? 'update' : 'publish', episode.id);
                    }}
                    type="button"
                  >
                    <Rocket className="h-4 w-4" />
                    {episode.status === 'published' ? '발행본 업데이트' : '발행'}
                  </button>
                  {episode.status === 'published' ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-red-400/60 hover:text-red-100 disabled:opacity-60"
                      disabled={isMutating}
                      onClick={() => {
                        void runPublishAction('unpublish', episode.id);
                      }}
                      type="button"
                    >
                      <RotateCcw className="h-4 w-4" />
                      비공개
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
