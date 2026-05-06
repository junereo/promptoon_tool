import { ArrowLeftLg as ArrowLeft, Save } from 'react-coolicons';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { usePatchProject, useProjects } from '../../../features/project/hooks/use-project-query';

export function StudioProjectSettingsPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;
  const patchProject = usePatchProject(projectId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      return;
    }

    setTitle(project.title);
    setDescription(project.description ?? '');
    setThumbnailUrl(project.thumbnailUrl ?? '');
  }, [project]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) {
      return;
    }

    await patchProject.mutateAsync({
      title,
      description: description.trim().length > 0 ? description : null,
      thumbnailUrl: thumbnailUrl.trim().length > 0 ? thumbnailUrl : null
    });
    setNotice('프로젝트 설정이 저장되었습니다.');
  }

  if (projectsQuery.isLoading) {
    return <main className="p-8 text-zinc-300">프로젝트 설정을 불러오고 있습니다.</main>;
  }

  if (projectsQuery.isError || !project || !projectId) {
    return <main className="p-8 text-red-200">프로젝트를 찾을 수 없습니다.</main>;
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${project.id}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Project Settings</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{project.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">채널과 공개 projection에 반영될 프로젝트 기본 정보를 관리합니다.</p>
      </section>

      <form className="grid gap-5 rounded-[32px] border border-editor-border bg-editor-panel/80 p-6" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-zinc-200">
          프로젝트 이름
          <input
            className="rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-zinc-50 outline-none transition focus:border-editor-accentSoft"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-200">
          설명
          <textarea
            className="min-h-32 rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-zinc-50 outline-none transition focus:border-editor-accentSoft"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-200">
          대표 이미지 URL
          <input
            className="rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-zinc-50 outline-none transition focus:border-editor-accentSoft"
            onChange={(event) => setThumbnailUrl(event.target.value)}
            placeholder="/uploads/..."
            value={thumbnailUrl}
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {notice ? <p className="text-sm text-emerald-200">{notice}</p> : <span />}
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-editor-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-editor-accentSoft disabled:opacity-60"
            disabled={patchProject.isPending}
            type="submit"
          >
            <Save className="h-4 w-4" />
            저장
          </button>
        </div>
      </form>
    </main>
  );
}
