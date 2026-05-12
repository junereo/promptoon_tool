import { ArrowLeftLg as ArrowLeft, Image01 as ImageIcon, Save, TrashFull as Trash2 } from 'react-coolicons';
import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { usePatchProject, useProjects, useUploadProjectAsset } from '../../../features/project/hooks/use-project-query';

const COVER_UPLOAD_INPUT_ID = 'project-cover-upload';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function StudioProjectSettingsPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;
  const patchProject = usePatchProject(projectId ?? '');
  const uploadProjectAsset = useUploadProjectAsset(projectId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPreviewUnavailable, setIsPreviewUnavailable] = useState(false);
  const trimmedThumbnailUrl = thumbnailUrl.trim();
  const hasCoverPreview = trimmedThumbnailUrl.length > 0 && !isPreviewUnavailable;

  useEffect(() => {
    if (!project) {
      return;
    }

    setTitle(project.title);
    setDescription(project.description ?? '');
    setThumbnailUrl(project.thumbnailUrl ?? '');
  }, [project]);

  useEffect(() => {
    setIsPreviewUnavailable(false);
  }, [thumbnailUrl]);

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !projectId) {
      return;
    }

    setNotice(null);
    setUploadError(null);

    try {
      const response = await uploadProjectAsset.mutateAsync(file);
      setThumbnailUrl(response.assetUrl);
      setNotice('대표 이미지가 업로드되었습니다. 저장하면 홈과 공개 영역에 적용됩니다.');
    } catch (error) {
      setUploadError(getErrorMessage(error, '대표 이미지 업로드에 실패했습니다.'));
    }
  }

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
    setUploadError(null);
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
        <section className="grid gap-4 rounded-2xl border border-editor-border bg-black/20 p-4">
          <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="aspect-[3/4] overflow-hidden rounded-lg border border-white/10 bg-black">
              {hasCoverPreview ? (
                <img
                  alt="현재 프로젝트 대표 이미지"
                  className="h-full w-full object-cover"
                  onError={() => setIsPreviewUnavailable(true)}
                  src={trimmedThumbnailUrl}
                />
              ) : (
                <div className="flex h-full flex-col justify-between bg-black p-3 text-zinc-500">
                  <span className="text-[10px] uppercase tracking-[0.2em]">Cover</span>
                  <span className="text-sm font-semibold text-zinc-400">대표 이미지 없음</span>
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-4">
              <label className="grid gap-2 text-sm font-medium text-zinc-200">
                대표 이미지 URL
                <input
                  className="rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-zinc-50 outline-none transition focus:border-editor-accentSoft"
                  onChange={(event) => setThumbnailUrl(event.target.value)}
                  placeholder="/uploads/..."
                  value={thumbnailUrl}
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadProjectAsset.isPending}
                  id={COVER_UPLOAD_INPUT_ID}
                  onChange={handleCoverUpload}
                  type="file"
                />
                <label
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-editor-border bg-white/8 px-4 text-sm font-semibold text-zinc-100 transition hover:border-editor-accentSoft hover:bg-white/12"
                  htmlFor={COVER_UPLOAD_INPUT_ID}
                >
                  <ImageIcon className="h-4 w-4" />
                  {uploadProjectAsset.isPending ? '업로드 중' : trimmedThumbnailUrl ? '이미지 교체' : '이미지 업로드'}
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-editor-border px-4 text-sm font-semibold text-zinc-300 transition hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadProjectAsset.isPending || trimmedThumbnailUrl.length === 0}
                  onClick={() => {
                    setThumbnailUrl('');
                    setNotice(null);
                    setUploadError(null);
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  비우기
                </button>
              </div>
              <p className="text-xs leading-5 text-zinc-500">저장된 대표 이미지는 홈 카드의 기본 cover로 사용됩니다.</p>
              {uploadError ? <p className="text-sm text-red-300">{uploadError}</p> : null}
            </div>
          </div>
        </section>
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
