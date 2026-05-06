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

import { useProjects } from '../../../features/project/hooks/use-project-query';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export function StudioProjectDetailPage() {
  const { projectId } = useParams();
  const projectsQuery = useProjects();
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;

  if (projectsQuery.isLoading) {
    return <StudioPageMessage message="프로젝트를 불러오고 있습니다." />;
  }

  if (projectsQuery.isError || !project) {
    return <StudioPageMessage tone="error" message="프로젝트를 찾을 수 없습니다." />;
  }

  const publishedCount = project.episodes.filter((episode) => episode.status === 'published').length;

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Project Detail</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{project.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{project.description || '프로젝트 설명이 없습니다.'}</p>
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
        <Metric label="상태" value={project.status} />
        <Metric label="에피소드" value={`${project.episodes.length}`} />
        <Metric label="발행됨" value={`${publishedCount}`} />
        <Metric label="업데이트" value={formatDate(project.updatedAt)} />
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
          description="프로젝트의 기본 시리즈와 에피소드 목록을 확인합니다."
          href={`/studio/projects/${project.id}/series`}
          title="시리즈 관리"
        />
        <ActionCard
          Icon={Users}
          description="프로젝트 멤버를 추가하고 제작/발행/검토 권한을 관리합니다."
          href={`/studio/projects/${project.id}/members`}
          title="멤버 권한"
        />
        <ActionCard
          Icon={ImageIcon}
          description="프로젝트 대표 이미지, 에피소드 커버, 컷 이미지를 한 곳에서 확인합니다."
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
          description="기존 제작 대시보드에서 에피소드를 추가하고 커버를 관리합니다."
          href="/studio/projects"
          title="대시보드"
        />
      </section>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-zinc-50">에피소드</h2>
            <p className="mt-1 text-sm text-zinc-400">편집기에서 컷, 선택지, 발행 상태를 관리합니다.</p>
          </div>
          <Link className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500" to="/studio/projects">
            새 에피소드 추가
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {project.episodes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-editor-border bg-black/10 p-6 text-sm text-zinc-500">
              아직 에피소드가 없습니다.
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
