import type {
  MovingtoonAspectRatio,
  ProjectWithEpisodes,
  PromptoonBackupExport,
  StudioProjectKind
} from '@promptoon/shared';
import {
  AddPlus as Plus,
  ArrowsReload01 as RotateCcw,
  MoreGridBig as GridIcon,
  PaperPlane as Send,
  Play,
  Rows,
  SearchMagnifyingGlass as Search
} from 'react-coolicons';
import { startTransition, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useCreateEpisode,
  useCreateMovingtoonEpisode,
  useCreateProject,
  useExportBackup,
  useProjects,
  usePublishMovingtoonEpisode,
  useUploadQueue
} from '../../../features/project/hooks/use-project-query';

type StudioFilter = 'all' | StudioProjectKind | 'draft' | 'in_review' | 'published';
type StudioViewMode = 'grid' | 'list';

const FILTERS: Array<{ key: StudioFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'promptoon', label: 'Promptoon' },
  { key: 'movingtoon', label: 'Movingtoon' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'draft', label: 'Draft' },
  { key: 'in_review', label: 'In Review' },
  { key: 'published', label: 'Published' }
];

function getBackupFileName(exportedAt: string): string {
  return `promptoon-backup-${exportedAt.replace(/[:.]/g, '-')}.json`;
}

function downloadBackupJson(backup: PromptoonBackupExport): void {
  const json = JSON.stringify(backup, null, 2);
  const anchor = document.createElement('a');
  anchor.download = getBackupFileName(backup.exportedAt);

  if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    anchor.href = url;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function getProjectKind(project: ProjectWithEpisodes): StudioProjectKind {
  if (project.kind) {
    return project.kind;
  }

  const movingtoonCount = project.movingtoonEpisodes?.length ?? 0;
  if (movingtoonCount > 0 && project.episodes.length > 0) {
    return 'hybrid';
  }
  if (movingtoonCount > 0) {
    return 'movingtoon';
  }
  return 'promptoon';
}

function getPosterUrl(project: ProjectWithEpisodes): string | null {
  return (
    project.thumbnailUrl ??
    project.movingtoonEpisodes?.find((episode) => episode.thumbnailUrl)?.thumbnailUrl ??
    project.episodes.find((episode) => episode.coverImageUrl)?.coverImageUrl ??
    null
  );
}

function getProjectDescription(project: ProjectWithEpisodes): string {
  return project.description || (getProjectKind(project) === 'movingtoon' ? 'Upload-based movingtoon project.' : 'Interactive promptoon project.');
}

function getProjectStats(project: ProjectWithEpisodes) {
  const movingtoonEpisodes = project.movingtoonEpisodes ?? [];
  const promptoonPublished = project.episodes.filter((episode) => episode.status === 'published').length;
  const movingtoonPublished = movingtoonEpisodes.filter((episode) => episode.publishStatus === 'published').length;
  return {
    episodeCount: project.episodes.length + movingtoonEpisodes.length,
    draftCount:
      project.episodes.filter((episode) => episode.status === 'draft').length +
      movingtoonEpisodes.filter((episode) => episode.publishStatus === 'draft').length,
    publishedCount: promptoonPublished + movingtoonPublished,
    processingCount: movingtoonEpisodes.filter((episode) => episode.processingStatus === 'uploading' || episode.processingStatus === 'processing').length,
    readyCount: movingtoonEpisodes.filter((episode) => episode.processingStatus === 'ready').length,
    failedCount: movingtoonEpisodes.filter((episode) => episode.processingStatus === 'failed').length
  };
}

function getProjectDisplayStatus(project: ProjectWithEpisodes): ProjectWithEpisodes['status'] {
  if (project.status === 'archived') {
    return project.status;
  }

  return getProjectStats(project).publishedCount > 0 ? 'published' : project.status;
}

function getNextEpisodeNumber(project: ProjectWithEpisodes): number {
  const promptoonMax = project.episodes.reduce((max, episode) => Math.max(max, episode.episodeNo), 0);
  const movingtoonMax = (project.movingtoonEpisodes ?? []).reduce((max, episode) => Math.max(max, episode.episodeNumber), 0);
  return Math.max(promptoonMax, movingtoonMax) + 1;
}

export function StudioProjectDashboardPage() {
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const uploadQueueQuery = useUploadQueue();
  const createProject = useCreateProject();
  const createEpisode = useCreateEpisode();
  const createMovingtoonEpisode = useCreateMovingtoonEpisode();
  const publishMovingtoonEpisode = usePublishMovingtoonEpisode();
  const exportBackup = useExportBackup();

  const [activeFilter, setActiveFilter] = useState<StudioFilter>('all');
  const [viewMode, setViewMode] = useState<StudioViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEpisodeDialogOpen, setIsEpisodeDialogOpen] = useState(false);

  const projects = projectsQuery.data ?? [];
  const uploadJobs = uploadQueueQuery.data?.jobs ?? [];

  const metrics = useMemo(() => {
    const activeProjects = projects.filter((project) => project.status !== 'archived').length;
    const uploadQueue = uploadJobs.filter((job) => job.status === 'uploading' || job.status === 'processing').length;
    const reviewNeeded =
      projects.filter((project) => project.status === 'in_review').length +
      projects.reduce((count, project) => count + (project.movingtoonEpisodes ?? []).filter((episode) => episode.processingStatus === 'failed').length, 0);
    const publishedEpisodes = projects.reduce((count, project) => count + getProjectStats(project).publishedCount, 0);
    return { activeProjects, uploadQueue, reviewNeeded, publishedEpisodes };
  }, [projects, uploadJobs]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const kind = getProjectKind(project);
      const displayStatus = getProjectDisplayStatus(project);
      const matchesFilter =
        activeFilter === 'all' ||
        activeFilter === kind ||
        activeFilter === displayStatus;
      const matchesSearch =
        !query ||
        project.title.toLowerCase().includes(query) ||
        getProjectDescription(project).toLowerCase().includes(query) ||
        project.episodes.some((episode) => episode.title.toLowerCase().includes(query)) ||
        (project.movingtoonEpisodes ?? []).some((episode) => episode.title.toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, projects, searchQuery]);

  async function handleExportBackup() {
    setBackupError(null);
    try {
      downloadBackupJson(await exportBackup.mutateAsync());
    } catch {
      setBackupError('Backup failed.');
    }
  }

  if (projectsQuery.isLoading) {
    return <StudioPageMessage message="Loading Studio projects..." />;
  }

  if (projectsQuery.isError) {
    return <StudioPageMessage tone="error" message="Failed to load Promptoon Studio." />;
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-lg border border-editor-border bg-editor-panel/85 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="font-display text-4xl font-semibold tracking-tight text-zinc-50">Promptoon Studio</p>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Create, upload, publish, and manage Promptoon / Movingtoon projects.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="studio-primary-button" onClick={() => setIsNewProjectDialogOpen(true)} type="button">
                <Plus className="h-4 w-4" />
                New Project
              </button>
              <button className="studio-secondary-button" onClick={() => setIsUploadDialogOpen(true)} type="button">
                <Play className="h-4 w-4 fill-current" />
                Upload Movingtoon
              </button>
              <button className="studio-secondary-button" onClick={() => setIsEpisodeDialogOpen(true)} type="button">
                <Send className="h-4 w-4" />
                Create Promptoon Episode
              </button>
              <button
                className="studio-ghost-button"
                disabled={exportBackup.isPending}
                onClick={() => {
                  void handleExportBackup();
                }}
                type="button"
              >
                <RotateCcw className="h-4 w-4" />
                {exportBackup.isPending ? 'Backing up...' : 'Backup JSON'}
              </button>
              {backupError ? <span className="text-sm text-red-300">{backupError}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Active Projects" value={`${metrics.activeProjects}`} detail="projects" />
        <MetricCard label="Upload Queue" value={`${metrics.uploadQueue}`} detail="processing" />
        <MetricCard label="Review Needed" value={`${metrics.reviewNeeded}`} detail="items" />
        <MetricCard label="Published Episodes" value={`${metrics.publishedEpisodes}`} detail="episodes" />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-editor-border bg-editor-panel/75 p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              className={[
                'rounded-md px-3 py-2 text-sm font-medium transition',
                activeFilter === filter.key ? 'bg-zinc-100 text-zinc-950' : 'bg-black/20 text-zinc-300 hover:bg-white/8 hover:text-white'
              ].join(' ')}
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <label className="flex min-w-0 items-center gap-2 rounded-md border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-300 sm:w-80">
            <Search className="h-4 w-4 shrink-0" />
            <input
              className="min-w-0 flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-500"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by project, episode, tag..."
              type="search"
              value={searchQuery}
            />
          </label>
        </div>
      </section>

      {filteredProjects.length === 0 ? (
        <section className="rounded-lg border border-dashed border-editor-border bg-editor-panel/60 p-10 text-center text-sm text-zinc-400">
          No Studio projects match the current filters.
        </section>
      ) : viewMode === 'grid' ? (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              onNewEpisode={() => {
                setIsEpisodeDialogOpen(true);
              }}
              onOpen={() => navigate(`/studio/projects/${project.id}`)}
              onPublishMovingtoon={(episodeId) => {
                void publishMovingtoonEpisode.mutateAsync(episodeId);
              }}
              onUpload={() => {
                setIsUploadDialogOpen(true);
              }}
              project={project}
            />
          ))}
        </section>
      ) : (
        <section className="grid gap-3">
          {filteredProjects.map((project) => (
            <ProjectListRow
              key={project.id}
              onNewEpisode={() => {
                setIsEpisodeDialogOpen(true);
              }}
              onOpen={() => navigate(`/studio/projects/${project.id}`)}
              onPublishMovingtoon={(episodeId) => {
                void publishMovingtoonEpisode.mutateAsync(episodeId);
              }}
              onUpload={() => {
                setIsUploadDialogOpen(true);
              }}
              project={project}
            />
          ))}
        </section>
      )}

      {isNewProjectDialogOpen ? (
        <NewProjectDialog
          isPending={createProject.isPending}
          onClose={() => setIsNewProjectDialogOpen(false)}
          onCreate={async (input) => {
            await createProject.mutateAsync(input);
            startTransition(() => setIsNewProjectDialogOpen(false));
          }}
        />
      ) : null}

      {isUploadDialogOpen ? (
        <MovingtoonUploadDialog
          isPending={createMovingtoonEpisode.isPending}
          onClose={() => setIsUploadDialogOpen(false)}
          onSubmit={async (input) => {
            await createMovingtoonEpisode.mutateAsync(input);
            startTransition(() => setIsUploadDialogOpen(false));
          }}
          projects={projects}
        />
      ) : null}

      {isEpisodeDialogOpen ? (
        <PromptoonEpisodeDialog
          isPending={createEpisode.isPending}
          onClose={() => setIsEpisodeDialogOpen(false)}
          onSubmit={async (input) => {
            await createEpisode.mutateAsync(input);
            startTransition(() => setIsEpisodeDialogOpen(false));
          }}
          projects={projects}
        />
      ) : null}
    </main>
  );
}

function StudioPageMessage({ message, tone = 'default' }: { message: string; tone?: 'default' | 'error' }) {
  return (
    <main className="w-full px-4 py-12 sm:px-6">
      <div
        className={
          tone === 'error'
            ? 'rounded-lg border border-red-500/20 bg-red-500/10 p-8 text-red-100'
            : 'rounded-lg border border-editor-border bg-editor-panel/85 p-8 text-zinc-300'
        }
      >
        {message}
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-editor-border bg-editor-panel/80 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{detail}</p>
    </article>
  );
}

function KindBadge({ kind }: { kind: StudioProjectKind }) {
  const label = kind === 'promptoon' ? 'PROMPTOON' : kind === 'movingtoon' ? 'MOVINGTOON' : 'HYBRID';
  return <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold tracking-[0.16em] text-zinc-950">{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-md border border-editor-border bg-black/35 px-2 py-1 text-xs text-zinc-300">{status.replace('_', ' ')}</span>;
}

function ExperimentalBadge() {
  return <span className="rounded-md border border-fuchsia-300/30 bg-fuchsia-400/12 px-2 py-1 text-xs font-bold text-fuchsia-100">실험형</span>;
}

function ViewModeToggle({ mode, onChange }: { mode: StudioViewMode; onChange: (mode: StudioViewMode) => void }) {
  return (
    <div aria-label="Project view mode" className="grid grid-cols-2 rounded-md border border-editor-border bg-black/20 p-1" role="group">
      <button
        aria-pressed={mode === 'grid'}
        className={[
          'inline-flex min-h-10 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition',
          mode === 'grid' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:bg-white/8 hover:text-white'
        ].join(' ')}
        onClick={() => onChange('grid')}
        type="button"
      >
        <GridIcon className="h-4 w-4" />
        Grid
      </button>
      <button
        aria-pressed={mode === 'list'}
        className={[
          'inline-flex min-h-10 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition',
          mode === 'list' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:bg-white/8 hover:text-white'
        ].join(' ')}
        onClick={() => onChange('list')}
        type="button"
      >
        <Rows className="h-4 w-4" />
        List
      </button>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onUpload,
  onNewEpisode,
  onPublishMovingtoon
}: {
  project: ProjectWithEpisodes;
  onOpen: () => void;
  onUpload: () => void;
  onNewEpisode: () => void;
  onPublishMovingtoon: (episodeId: string) => void;
}) {
  const kind = getProjectKind(project);
  const stats = getProjectStats(project);
  const posterUrl = getPosterUrl(project);

  return (
    <article className="overflow-hidden rounded-lg border border-editor-border bg-editor-panel/80 shadow-xl shadow-black/15">
      <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-4 p-4">
        <button className="aspect-[9/16] overflow-hidden rounded-md bg-black text-left" onClick={onOpen} type="button">
          {posterUrl ? (
            <img alt="" className="h-full w-full object-cover" src={posterUrl} />
          ) : (
            <div className="flex h-full flex-col justify-between bg-[linear-gradient(145deg,#111115,#23252b)] p-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">9:16 Poster</span>
              <span className="font-display text-xl font-semibold text-zinc-200">{project.title.slice(0, 18)}</span>
            </div>
          )}
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={kind} />
            <StatusBadge status={getProjectDisplayStatus(project)} />
            {project.isExperimental ? <ExperimentalBadge /> : null}
          </div>
          <h2 className="mt-3 truncate font-display text-2xl font-semibold text-zinc-50">{project.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{getProjectDescription(project)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <Stat label="Episodes" value={`${stats.episodeCount}`} />
            <Stat label="Draft" value={`${stats.draftCount}`} />
            <Stat label="Published" value={`${stats.publishedCount}`} />
          </div>
          {kind !== 'promptoon' ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <Stat label="Ready" value={`${stats.readyCount}`} />
              <Stat label="Processing" value={`${stats.processingCount}`} />
              <Stat label="Failed" value={`${stats.failedCount}`} tone={stats.failedCount > 0 ? 'danger' : 'default'} />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">Updated {formatDate(project.updatedAt)}</p>
        </div>
      </div>
      <ProjectActions
        className="flex flex-wrap gap-2 border-t border-editor-border bg-black/15 p-3"
        onNewEpisode={onNewEpisode}
        onOpen={onOpen}
        onPublishMovingtoon={onPublishMovingtoon}
        onUpload={onUpload}
        project={project}
      />
    </article>
  );
}

function ProjectListRow({
  project,
  onOpen,
  onUpload,
  onNewEpisode,
  onPublishMovingtoon
}: {
  project: ProjectWithEpisodes;
  onOpen: () => void;
  onUpload: () => void;
  onNewEpisode: () => void;
  onPublishMovingtoon: (episodeId: string) => void;
}) {
  const kind = getProjectKind(project);
  const stats = getProjectStats(project);
  const posterUrl = getPosterUrl(project);

  return (
    <article className="rounded-lg border border-editor-border bg-editor-panel/80 p-3 shadow-lg shadow-black/10">
      <div className="grid gap-3 lg:grid-cols-[4.75rem_minmax(0,1.45fr)_minmax(14rem,0.95fr)_8rem_minmax(15rem,auto)] lg:items-center">
        <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 lg:contents">
          <button className="aspect-[9/16] overflow-hidden rounded-md bg-black text-left" onClick={onOpen} type="button">
            {posterUrl ? (
              <img alt="" className="h-full w-full object-cover" src={posterUrl} />
            ) : (
              <div className="flex h-full flex-col justify-between bg-[linear-gradient(145deg,#111115,#23252b)] p-2">
                <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Poster</span>
                <span className="font-display text-sm font-semibold text-zinc-200">{project.title.slice(0, 10)}</span>
              </div>
            )}
          </button>
          <div className="min-w-0 self-center">
            <div className="flex flex-wrap items-center gap-2">
              <KindBadge kind={kind} />
              <StatusBadge status={getProjectDisplayStatus(project)} />
              {project.isExperimental ? <ExperimentalBadge /> : null}
            </div>
            <button className="mt-2 block max-w-full text-left" onClick={onOpen} type="button">
              <h2 className="truncate font-display text-xl font-semibold text-zinc-50">{project.title}</h2>
            </button>
            <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{getProjectDescription(project)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <CompactStat label="Episodes" value={`${stats.episodeCount}`} />
          <CompactStat label="Draft" value={`${stats.draftCount}`} />
          <CompactStat label="Published" value={`${stats.publishedCount}`} />
        </div>

        <div className="rounded-md bg-black/20 px-3 py-2 text-sm">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{kind === 'promptoon' ? 'Updated' : 'Pipeline'}</p>
          <p className="mt-1 font-semibold text-zinc-100">
            {kind === 'promptoon' ? formatDate(project.updatedAt) : `${stats.readyCount}R / ${stats.processingCount}P / ${stats.failedCount}F`}
          </p>
        </div>

        <ProjectActions
          className="flex flex-wrap gap-2 lg:justify-end"
          onNewEpisode={onNewEpisode}
          onOpen={onOpen}
          onPublishMovingtoon={onPublishMovingtoon}
          onUpload={onUpload}
          project={project}
        />
      </div>
      {kind !== 'promptoon' ? (
        <div className="mt-3 grid gap-2 border-t border-editor-border pt-3 text-sm sm:grid-cols-3 lg:hidden">
          <CompactStat label="Processing" value={`${stats.processingCount}`} />
          <CompactStat label="Ready" value={`${stats.readyCount}`} />
          <CompactStat label="Failed" value={`${stats.failedCount}`} tone={stats.failedCount > 0 ? 'danger' : 'default'} />
        </div>
      ) : null}
    </article>
  );
}

function ProjectActions({
  project,
  onOpen,
  onUpload,
  onNewEpisode,
  onPublishMovingtoon,
  className
}: {
  project: ProjectWithEpisodes;
  onOpen: () => void;
  onUpload: () => void;
  onNewEpisode: () => void;
  onPublishMovingtoon: (episodeId: string) => void;
  className: string;
}) {
  const kind = getProjectKind(project);
  const readyToPublish = (project.movingtoonEpisodes ?? []).find(
    (episode) => episode.processingStatus === 'ready' && episode.publishStatus !== 'published'
  );

  return (
    <div className={className}>
      <button className="studio-secondary-button" onClick={onOpen} type="button">
        {kind === 'promptoon' ? 'Open Editor' : 'Manage'}
      </button>
      {kind === 'promptoon' ? (
        <button className="studio-ghost-button" onClick={onNewEpisode} type="button">
          New Episode
        </button>
      ) : (
        <button className="studio-ghost-button" onClick={onUpload} type="button">
          Upload Episode
        </button>
      )}
      {readyToPublish ? (
        <button className="studio-ghost-button" onClick={() => onPublishMovingtoon(readyToPublish.id)} type="button">
          Publish Ready
        </button>
      ) : null}
      <button className="studio-ghost-button opacity-70" disabled type="button">
        Create with Engine
      </button>
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <div className="rounded-md bg-black/25 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={tone === 'danger' ? 'mt-1 font-semibold text-red-300' : 'mt-1 font-semibold text-zinc-100'}>{value}</p>
    </div>
  );
}

function CompactStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <div className="rounded-md bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className={tone === 'danger' ? 'mt-1 font-semibold text-red-300' : 'mt-1 font-semibold text-zinc-100'}>{value}</p>
    </div>
  );
}

function DialogFrame({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button aria-label="Close dialog" className="absolute inset-0 cursor-default bg-black/65" onClick={onClose} type="button" />
      <section className="relative w-full max-w-xl rounded-lg border border-editor-border bg-editor-panel p-5 shadow-2xl shadow-black/40">
        <h2 className="font-display text-2xl font-semibold text-zinc-50">{title}</h2>
        {children}
      </section>
    </div>
  );
}

function NewProjectDialog({
  isPending,
  onClose,
  onCreate
}: {
  isPending: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; description?: string; kind: StudioProjectKind }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<StudioProjectKind>('promptoon');

  return (
    <DialogFrame onClose={onClose} title="New Project">
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            return;
          }
          void onCreate({ title: title.trim(), description: description.trim() || undefined, kind });
        }}
      >
        <TextField label="Title" onChange={setTitle} placeholder="Project title" value={title} />
        <TextField label="Description" onChange={setDescription} placeholder="Short description" value={description} />
        <SelectField
          label="Kind"
          onChange={(value) => setKind(value as StudioProjectKind)}
          options={[
            ['promptoon', 'Promptoon'],
            ['movingtoon', 'Movingtoon'],
            ['hybrid', 'Hybrid']
          ]}
          value={kind}
        />
        <DialogActions isPending={isPending} onClose={onClose} submitLabel="Create Project" />
      </form>
    </DialogFrame>
  );
}

function MovingtoonUploadDialog({
  projects,
  isPending,
  onClose,
  onSubmit
}: {
  projects: ProjectWithEpisodes[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: { projectId: string; payload: { file: File; title: string; description?: string; episodeNumber: number; aspectRatio: MovingtoonAspectRatio } }) => Promise<void>;
}) {
  const candidateProjects = projects.filter((project) => getProjectKind(project) !== 'promptoon' || (project.movingtoonEpisodes?.length ?? 0) > 0);
  const selectableProjects = candidateProjects.length > 0 ? candidateProjects : projects;
  const [projectId, setProjectId] = useState(selectableProjects[0]?.id ?? '');
  const selectedProject = projects.find((project) => project.id === projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState(selectedProject ? getNextEpisodeNumber(selectedProject) : 1);
  const [aspectRatio, setAspectRatio] = useState<MovingtoonAspectRatio>('9:16');
  const [file, setFile] = useState<File | null>(null);

  return (
    <DialogFrame onClose={onClose} title="Upload Movingtoon">
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!projectId || !title.trim() || !file) {
            return;
          }
          void onSubmit({
            projectId,
            payload: {
              file,
              title: title.trim(),
              description: description.trim() || undefined,
              episodeNumber,
              aspectRatio
            }
          });
        }}
      >
        <SelectField
          label="Project"
          onChange={(value) => {
            setProjectId(value);
            const nextProject = projects.find((project) => project.id === value);
            setEpisodeNumber(nextProject ? getNextEpisodeNumber(nextProject) : 1);
          }}
          options={selectableProjects.map((project) => [project.id, project.title])}
          value={projectId}
        />
        <label className="block rounded-lg border border-dashed border-editor-border bg-black/20 p-6 text-center text-sm text-zinc-400 transition hover:border-zinc-500">
          <input
            accept="video/*"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          {file ? file.name : 'Drop or choose a movingtoon video file'}
        </label>
        <TextField label="Title" onChange={setTitle} placeholder="Episode title" value={title} />
        <TextField label="Description" onChange={setDescription} placeholder="Feed caption or short description" value={description} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-300">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">Episode Number</span>
            <input
              className="studio-input"
              min={1}
              onChange={(event) => setEpisodeNumber(Number(event.target.value))}
              type="number"
              value={episodeNumber}
            />
          </label>
          <SelectField
            label="Aspect Ratio"
            onChange={(value) => setAspectRatio(value as MovingtoonAspectRatio)}
            options={[
              ['9:16', '9:16'],
              ['16:9', '16:9'],
              ['1:1', '1:1']
            ]}
            value={aspectRatio}
          />
        </div>
        <div className="rounded-lg border border-editor-border bg-black/20 p-5 text-sm text-zinc-500">Thumbnail will be generated during processing.</div>
        <DialogActions isPending={isPending} onClose={onClose} submitLabel="Create / Upload" />
      </form>
    </DialogFrame>
  );
}

function PromptoonEpisodeDialog({
  projects,
  isPending,
  onClose,
  onSubmit
}: {
  projects: ProjectWithEpisodes[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: { projectId: string; payload: { title: string; episodeNo: number } }) => Promise<void>;
}) {
  const selectableProjects = projects.filter((project) => getProjectKind(project) !== 'movingtoon');
  const [projectId, setProjectId] = useState(selectableProjects[0]?.id ?? '');
  const selectedProject = selectableProjects.find((project) => project.id === projectId);
  const [title, setTitle] = useState('');

  return (
    <DialogFrame onClose={onClose} title="Create Promptoon Episode">
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!projectId || !title.trim() || !selectedProject) {
            return;
          }
          void onSubmit({
            projectId,
            payload: {
              title: title.trim(),
              episodeNo: getNextEpisodeNumber(selectedProject)
            }
          });
        }}
      >
        <SelectField
          label="Project"
          onChange={setProjectId}
          options={selectableProjects.map((project) => [project.id, project.title])}
          value={projectId}
        />
        <TextField label="Episode Title" onChange={setTitle} placeholder="Episode title" value={title} />
        <DialogActions isPending={isPending} onClose={onClose} submitLabel="Create Episode" />
      </form>
    </DialogFrame>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm text-zinc-300">
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input className="studio-input" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="text" value={value} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <select className="studio-input" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function DialogActions({ isPending, onClose, submitLabel }: { isPending: boolean; onClose: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button className="studio-ghost-button" onClick={onClose} type="button">
        Cancel
      </button>
      <button className="studio-primary-button" disabled={isPending} type="submit">
        {isPending ? 'Working...' : submitLabel}
      </button>
    </div>
  );
}
