import {
  ChartBarVertical01 as BarChart3,
  BookOpen,
  Clock as History,
  Image01 as ImageIcon,
  Layers as Layers3,
  PaperPlane as Send,
  Settings,
  EditPencilLine01 as SquarePen,
  Users
} from 'react-coolicons';
import { Link, useParams } from 'react-router-dom';
import type { MovingtoonEpisodeSummary, ProjectWithEpisodes, StudioProjectKind } from '@promptoon/shared';

import { useProjects, usePublishMovingtoonEpisode, useUnpublishMovingtoonEpisode } from '../../../features/project/hooks/use-project-query';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function formatDuration(durationSec: number | null): string {
  if (!durationSec || durationSec <= 0) {
    return '-';
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
}

function getProjectKind(project: ProjectWithEpisodes): StudioProjectKind {
  if (project.kind) {
    return project.kind;
  }

  return (project.movingtoonEpisodes?.length ?? 0) > 0 ? 'movingtoon' : 'promptoon';
}

function getProjectDisplayStatus(project: ProjectWithEpisodes): string {
  const hasPublishedPromptoon = project.episodes.some((episode) => episode.status === 'published');
  const hasPublishedMovingtoon = (project.movingtoonEpisodes ?? []).some((episode) => episode.publishStatus === 'published');
  return hasPublishedPromptoon || hasPublishedMovingtoon ? 'published' : project.status;
}

function getMovingtoonProcessingCounts(episodes: MovingtoonEpisodeSummary[]) {
  return {
    failed: episodes.filter((episode) => episode.processingStatus === 'failed').length,
    processing: episodes.filter((episode) => episode.processingStatus === 'processing' || episode.processingStatus === 'uploading').length,
    ready: episodes.filter((episode) => episode.processingStatus === 'ready').length
  };
}

export function StudioProjectDetailPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const publishMovingtoonEpisode = usePublishMovingtoonEpisode();
  const unpublishMovingtoonEpisode = useUnpublishMovingtoonEpisode();
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;

  if (projectsQuery.isLoading) {
    return <StudioPageMessage message="프로젝트를 불러오고 있습니다." />;
  }

  if (projectsQuery.isError || !project) {
    return <StudioPageMessage tone="error" message="프로젝트를 찾을 수 없습니다." />;
  }

  const kind = getProjectKind(project);
  const movingtoonEpisodes = project.movingtoonEpisodes ?? [];
  const movingtoonCounts = getMovingtoonProcessingCounts(movingtoonEpisodes);
  const promptoonPublishedCount = project.episodes.filter((episode) => episode.status === 'published').length;
  const movingtoonPublishedCount = movingtoonEpisodes.filter((episode) => episode.publishStatus === 'published').length;
  const publishedCount = promptoonPublishedCount + movingtoonPublishedCount;
  const totalEpisodeCount = project.episodes.length + movingtoonEpisodes.length;
  const hasMovingtoonEpisodes = movingtoonEpisodes.length > 0;
  const hasPromptoonEpisodes = project.episodes.length > 0;

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Project Detail</p>
              <KindBadge kind={kind} />
              <StatusBadge status={getProjectDisplayStatus(project)} />
            </div>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{project.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{project.description || '프로젝트 설명이 없습니다.'}</p>
            {hasMovingtoonEpisodes ? (
              <p className="mt-3 text-sm text-zinc-500">
                무빙툰 {movingtoonEpisodes.length}개, Ready {movingtoonCounts.ready}개, Processing {movingtoonCounts.processing}개, Failed {movingtoonCounts.failed}개
              </p>
            ) : null}
          </div>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-editor-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-editor-accentSoft"
            to={`/studio/projects/${project.id}/publish`}
          >
            <Send className="h-4 w-4" />
            발행 관리
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="상태" value={getProjectDisplayStatus(project)} />
        <Metric label="에피소드" value={`${totalEpisodeCount}`} />
        <Metric label="발행됨" value={`${publishedCount}`} />
        <Metric
          label={hasMovingtoonEpisodes ? '처리 상태' : '업데이트'}
          value={hasMovingtoonEpisodes ? `${movingtoonCounts.ready}/${movingtoonEpisodes.length} ready` : formatDate(project.updatedAt)}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          Icon={Settings}
          description="공개 채널과 projection에 반영될 제목, 설명, 대표 이미지를 관리합니다."
          href={`/studio/projects/${project.id}/settings`}
          title="프로젝트 설정"
        />
        <ActionCard
          Icon={BookOpen}
          description={kind === 'promptoon' ? '프로젝트의 기본 시리즈와 에피소드 목록을 확인합니다.' : '무빙툰 에피소드 목록, 처리 상태, 발행 상태를 확인합니다.'}
          href={`/studio/projects/${project.id}/series`}
          title={kind === 'promptoon' ? '시리즈 관리' : '무빙툰 에피소드'}
        />
        <ActionCard
          Icon={Users}
          description="프로젝트 멤버를 추가하고 제작/발행/검토 권한을 관리합니다."
          href={`/studio/projects/${project.id}/members`}
          title="멤버 권한"
        />
        <ActionCard
          Icon={ImageIcon}
          description={kind === 'promptoon' ? '프로젝트 대표 이미지, 에피소드 커버, 컷 이미지를 한 곳에서 확인합니다.' : '원본 영상, 변환 영상, 썸네일, 포스터 에셋을 한 곳에서 확인합니다.'}
          href={`/studio/projects/${project.id}/assets`}
          title="에셋 라이브러리"
        />
        <ActionCard
          Icon={BarChart3}
          description="발행 상태, 에피소드 수, 분석 진입점을 한 곳에서 봅니다."
          href={`/studio/projects/${project.id}/analytics`}
          title="분석 요약"
        />
        <ActionCard
          Icon={History}
          description="발행본 버전과 공개 Viewer 진입점을 확인합니다."
          href={`/studio/projects/${project.id}/history`}
          title="발행 이력"
        />
        <ActionCard
          Icon={Layers3}
          description={kind === 'promptoon' ? '기존 제작 대시보드에서 에피소드를 추가하고 커버를 관리합니다.' : 'Studio Home에서 무빙툰 영상을 추가 업로드하고 상태를 추적합니다.'}
          href="/studio/projects"
          title="대시보드"
        />
      </section>

      {kind !== 'promptoon' ? (
        <MovingtoonEpisodeSection
          episodes={movingtoonEpisodes}
          isPublishing={publishMovingtoonEpisode.isPending}
          isUnpublishing={unpublishMovingtoonEpisode.isPending}
          onPublish={(episodeId) => {
            void publishMovingtoonEpisode.mutateAsync(episodeId);
          }}
          onUnpublish={(episodeId) => {
            void unpublishMovingtoonEpisode.mutateAsync(episodeId);
          }}
          projectId={project.id}
        />
      ) : null}

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-zinc-50">{kind === 'promptoon' ? '에피소드' : '프롬툰 에피소드'}</h2>
            <p className="mt-1 text-sm text-zinc-400">편집기에서 컷, 선택지, 발행 상태를 관리합니다.</p>
          </div>
          <Link className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500" to="/studio/projects">
            새 에피소드 추가
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {!hasPromptoonEpisodes ? (
            <p className="rounded-2xl border border-dashed border-editor-border bg-black/10 p-6 text-sm text-zinc-500">
              {hasMovingtoonEpisodes ? '프롬툰 에피소드는 아직 없습니다. 위의 무빙툰 에피소드 목록에서 업로드 영상을 확인하세요.' : '아직 에피소드가 없습니다.'}
            </p>
          ) : (
            project.episodes.map((episode) => (
              <Link
                className="flex items-center justify-between gap-4 rounded-2xl border border-editor-border bg-black/10 p-4 transition hover:border-editor-accentSoft hover:bg-black/20"
                key={episode.id}
                to={`/studio/projects/${project.id}/episodes/${episode.id}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-100">
                    EP.{episode.episodeNo} {episode.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">상태: {episode.status}</p>
                </div>
                <SquarePen className="h-5 w-5 shrink-0 text-zinc-400" />
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function MovingtoonEpisodeSection({
  episodes,
  isPublishing,
  isUnpublishing,
  onPublish,
  onUnpublish,
  projectId
}: {
  episodes: MovingtoonEpisodeSummary[];
  isPublishing: boolean;
  isUnpublishing: boolean;
  onPublish: (episodeId: string) => void;
  onUnpublish: (episodeId: string) => void;
  projectId: string;
}) {
  return (
    <section className="rounded-[32px] border border-editor-border bg-editor-panel/80 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-zinc-50">무빙툰 에피소드</h2>
          <p className="mt-1 text-sm text-zinc-400">업로드 영상, 변환 상태, 썸네일, 발행 상태를 확인합니다.</p>
        </div>
        <Link className="studio-secondary-button" to="/studio/projects">
          Upload Movingtoon
        </Link>
      </div>

      <div className="mt-5 grid gap-4">
        {episodes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-editor-border bg-black/10 p-6 text-sm text-zinc-500">
            아직 업로드된 무빙툰 에피소드가 없습니다.
          </p>
        ) : (
          episodes
            .slice()
            .sort((first, second) => first.episodeNumber - second.episodeNumber)
            .map((episode) => (
              <MovingtoonEpisodeCard
                episode={episode}
                isPublishing={isPublishing}
                isUnpublishing={isUnpublishing}
                key={episode.id}
                onPublish={() => onPublish(episode.id)}
                onUnpublish={() => onUnpublish(episode.id)}
                projectId={projectId}
              />
            ))
        )}
      </div>
    </section>
  );
}

function MovingtoonEpisodeCard({
  episode,
  isPublishing,
  isUnpublishing,
  onPublish,
  onUnpublish,
  projectId
}: {
  episode: MovingtoonEpisodeSummary;
  isPublishing: boolean;
  isUnpublishing: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  projectId: string;
}) {
  const canPublish = episode.processingStatus === 'ready' && episode.publishStatus !== 'published';
  const canUnpublish = episode.publishStatus === 'published';

  return (
    <article className="grid gap-4 rounded-[28px] border border-editor-border bg-black/15 p-4 md:grid-cols-[8rem_minmax(0,1fr)]">
      <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-black/40">
        {episode.thumbnailUrl ? (
          <img alt={`${episode.title} thumbnail`} className="h-full w-full object-cover" src={episode.thumbnailUrl} />
        ) : (
          <div className="flex h-full flex-col justify-between bg-[linear-gradient(145deg,#111115,#23252b)] p-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{episode.aspectRatio}</span>
            <span className="font-display text-lg font-semibold text-zinc-200">EP.{episode.episodeNumber}</span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={`EP.${episode.episodeNumber}`} />
          <ProcessingBadge status={episode.processingStatus} />
          <PublishBadge status={episode.publishStatus} />
        </div>
        <h3 className="mt-3 truncate font-display text-2xl font-semibold text-zinc-50">{episode.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{episode.description || '에피소드 설명이 없습니다.'}</p>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <Info label="Duration" value={formatDuration(episode.durationSec)} />
          <Info label="Aspect" value={episode.aspectRatio} />
          <Info label="Updated" value={formatDate(episode.updatedAt)} />
          <Info label="Published" value={episode.publishedAt ? formatDate(episode.publishedAt) : '-'} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {episode.videoUrl ? (
            <a className="studio-secondary-button" href={episode.videoUrl} rel="noreferrer" target="_blank">
              변환 영상 열기
            </a>
          ) : null}
          {episode.originalVideoUrl ? (
            <a className="studio-ghost-button" href={episode.originalVideoUrl} rel="noreferrer" target="_blank">
              원본 영상
            </a>
          ) : null}
          {canPublish ? (
            <button className="studio-primary-button" disabled={isPublishing} onClick={onPublish} type="button">
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          ) : null}
          {canUnpublish ? (
            <button className="studio-secondary-button" disabled={isUnpublishing} onClick={onUnpublish} type="button">
              {isUnpublishing ? 'Unpublishing...' : 'Unpublish'}
            </button>
          ) : null}
          {canUnpublish ? (
            <Link className="studio-ghost-button" to={`/studio/projects/${projectId}/history`}>
              발행 이력 보기
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StudioPageMessage({ message, tone = 'default' }: { message: string; tone?: 'default' | 'error' }) {
  return (
    <main className="w-full px-4 py-12 sm:px-6">
      <div
        className={
          tone === 'error'
            ? 'rounded-[32px] border border-red-500/20 bg-red-500/10 p-8 text-red-100'
            : 'rounded-[32px] border border-editor-border bg-editor-panel/85 p-8 text-zinc-300'
        }
      >
        {message}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 font-display text-2xl font-semibold text-zinc-50">{value}</p>
    </article>
  );
}

function KindBadge({ kind }: { kind: StudioProjectKind }) {
  const label = kind === 'promptoon' ? 'PROMPTOON' : kind === 'movingtoon' ? 'MOVINGTOON' : 'HYBRID';
  return <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold tracking-[0.16em] text-zinc-950">{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-md border border-editor-border bg-black/35 px-2 py-1 text-xs text-zinc-300">{status.replaceAll('_', ' ')}</span>;
}

function ProcessingBadge({ status }: { status: MovingtoonEpisodeSummary['processingStatus'] }) {
  const className =
    status === 'failed'
      ? 'border-red-400/30 bg-red-500/12 text-red-200'
      : status === 'ready'
        ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
        : 'border-amber-400/30 bg-amber-500/12 text-amber-100';

  return <span className={`rounded-md border px-2 py-1 text-xs ${className}`}>{status}</span>;
}

function PublishBadge({ status }: { status: MovingtoonEpisodeSummary['publishStatus'] }) {
  const className =
    status === 'published'
      ? 'border-sky-400/30 bg-sky-500/12 text-sky-200'
      : 'border-editor-border bg-black/35 text-zinc-300';

  return <span className={`rounded-md border px-2 py-1 text-xs ${className}`}>{status}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-100">{value}</dd>
    </div>
  );
}

function ActionCard({
  Icon,
  title,
  description,
  href
}: {
  Icon: typeof BookOpen;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-6 transition hover:border-editor-accentSoft" to={href}>
      <Icon className="h-6 w-6 text-editor-accentSoft" />
      <h2 className="mt-4 font-display text-xl font-semibold text-zinc-50">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </Link>
  );
}
