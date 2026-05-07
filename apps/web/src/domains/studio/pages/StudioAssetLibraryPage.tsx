import { ArrowLeftLg as ArrowLeft, Image01 as ImageIcon } from 'react-coolicons';
import { Link, useParams } from 'react-router-dom';
import type { ProjectAssetSource } from '@promptoon/shared';

import { useProjectAssets, useProjects } from '../../../features/project/hooks/use-project-query';

const SOURCE_LABELS = {
  project_thumbnail: '프로젝트 대표 이미지',
  episode_cover: '에피소드 커버',
  cut_asset: '컷 이미지',
  movingtoon_video: '무빙툰 비디오',
  movingtoon_thumbnail: '무빙툰 썸네일',
  upload: '업로드 에셋'
} satisfies Record<ProjectAssetSource, string>;

export function StudioAssetLibraryPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const assetsQuery = useProjectAssets(projectId);
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;

  if (projectsQuery.isLoading || assetsQuery.isLoading) {
    return <main className="p-8 text-zinc-300">에셋을 불러오고 있습니다.</main>;
  }

  if (projectsQuery.isError || assetsQuery.isError || !project) {
    return <main className="p-8 text-red-200">에셋 라이브러리를 불러올 수 없습니다.</main>;
  }

  const assets = assetsQuery.data?.assets ?? [];

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${project.id}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Asset Library</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{project.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">프로젝트 대표 이미지, 에피소드 커버, 컷 이미지를 한 곳에서 확인합니다.</p>
      </section>

      {assets.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-editor-border bg-black/10 p-8 text-zinc-500">
          연결된 에셋이 없습니다.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <article className="overflow-hidden rounded-[28px] border border-editor-border bg-editor-panel/75" key={`${asset.source}:${asset.assetUrl}`}>
              <div className="aspect-[16/10] bg-black/30">
                <img alt="" className="h-full w-full object-cover" src={asset.assetUrl} />
              </div>
              <div className="p-4">
                <p className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1 text-xs text-editor-accentSoft">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {SOURCE_LABELS[asset.source]}
                </p>
                <h2 className="mt-3 truncate font-semibold text-zinc-100">{asset.cutTitle ?? asset.episodeTitle ?? project.title}</h2>
                <p className="mt-1 truncate text-xs text-zinc-500">{asset.assetUrl}</p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
