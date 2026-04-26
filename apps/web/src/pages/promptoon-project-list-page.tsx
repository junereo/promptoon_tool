import { startTransition, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUploadAsset } from '../features/editor/hooks/use-episode-query';
import { useCreateEpisode, useCreateProject, useProjects, useUpdateEpisode } from '../features/project/hooks/use-project-query';

function createEpisodeInputId(projectId: string): string {
  return `episode-title-${projectId}`;
}

export function PromptoonProjectListPage() {
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const createProject = useCreateProject();
  const createEpisode = useCreateEpisode();
  const updateEpisode = useUpdateEpisode();
  const uploadAsset = useUploadAsset();

  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [projectDescriptions, setProjectDescriptions] = useState<Record<string, string>>({});
  const [episodeTitlesByProjectId, setEpisodeTitlesByProjectId] = useState<Record<string, string>>({});
  const [uploadingEpisodeId, setUploadingEpisodeId] = useState<string | null>(null);
  const [uploadErrorByEpisodeId, setUploadErrorByEpisodeId] = useState<Record<string, string>>({});

  async function handleCreateProject() {
    const title = newProjectTitle.trim();
    if (!title) {
      return;
    }

    await createProject.mutateAsync({
      title,
      description: projectDescriptions.newProject?.trim() || undefined
    });

    startTransition(() => {
      setNewProjectTitle('');
      setProjectDescriptions((current) => ({
        ...current,
        newProject: ''
      }));
    });
  }

  async function handleCreateEpisode(projectId: string, currentEpisodeCount: number) {
    const title = episodeTitlesByProjectId[projectId]?.trim();
    if (!title) {
      return;
    }

    await createEpisode.mutateAsync({
      projectId,
      payload: {
        title,
        episodeNo: currentEpisodeCount + 1
      }
    });

    startTransition(() => {
      setEpisodeTitlesByProjectId((current) => ({
        ...current,
        [projectId]: ''
      }));
    });
  }

  async function handleEpisodeCoverUpload(projectId: string, episodeId: string, file: File | null) {
    if (!file) {
      return;
    }

    setUploadingEpisodeId(episodeId);
    setUploadErrorByEpisodeId((current) => ({
      ...current,
      [episodeId]: ''
    }));

    try {
      const response = await uploadAsset.mutateAsync({ projectId, file });
      await updateEpisode.mutateAsync({
        episodeId,
        payload: {
          coverImageUrl: response.assetUrl
        }
      });
    } catch {
      setUploadErrorByEpisodeId((current) => ({
        ...current,
        [episodeId]: 'Cover upload failed.'
      }));
    } finally {
      setUploadingEpisodeId((current) => (current === episodeId ? null : current));
    }
  }

  if (projectsQuery.isLoading) {
    return (
      <main className="w-full px-4 py-12 sm:px-6">
        <div className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-8 text-zinc-300">
          Loading projects...
        </div>
      </main>
    );
  }

  if (projectsQuery.isError) {
    return (
      <main className="w-full px-4 py-12 sm:px-6">
        <div className="rounded-[32px] border border-red-500/20 bg-red-500/10 p-8 text-red-100">
          Failed to load the project dashboard.
        </div>
      </main>
    );
  }

  const projects = projectsQuery.data ?? [];

  return (
    <main className="flex w-full flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-8 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="font-display text-4xl font-semibold tracking-tight text-zinc-50">Project Dashboard</p>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Create projects, add episodes, and enter the authoring editor from a single dashboard.
            </p>
          </div>

          <div className="grid w-full max-w-2xl gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <input
              className="rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
              onChange={(event) => setNewProjectTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreateProject();
                }
              }}
              placeholder="New project title"
              type="text"
              value={newProjectTitle}
            />
            <input
              className="rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
              onChange={(event) =>
                setProjectDescriptions((current) => ({
                  ...current,
                  newProject: event.target.value
                }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreateProject();
                }
              }}
              placeholder="Short description"
              type="text"
              value={projectDescriptions.newProject ?? ''}
            />
            <button
              className="rounded-2xl bg-editor-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={createProject.isPending || newProjectTitle.trim().length === 0}
              onClick={() => {
                void handleCreateProject();
              }}
              type="button"
            >
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </section>

      {projects.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-editor-border bg-editor-panel/70 p-14 text-center text-zinc-400">
          No projects yet. Create the first one to start authoring Promptoon episodes.
        </section>
      ) : (
        <section className="grid gap-6">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-[32px] border border-editor-border bg-editor-panel/80 p-7 shadow-xl shadow-black/15"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-2xl font-semibold text-zinc-50">{project.title}</p>
                    <span className="rounded-full border border-editor-border bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-zinc-400">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                    {project.description || 'No description yet.'}
                  </p>
                </div>

                <div className="grid w-full max-w-2xl gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    className="rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                    id={createEpisodeInputId(project.id)}
                    onChange={(event) =>
                      setEpisodeTitlesByProjectId((current) => ({
                        ...current,
                        [project.id]: event.target.value
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleCreateEpisode(project.id, project.episodes.length);
                      }
                    }}
                    placeholder={`New episode title for ${project.title}`}
                    type="text"
                    value={episodeTitlesByProjectId[project.id] ?? ''}
                  />
                  <button
                    className="rounded-2xl border border-editor-border px-5 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={createEpisode.isPending || !(episodeTitlesByProjectId[project.id] ?? '').trim()}
                    onClick={() => {
                      void handleCreateEpisode(project.id, project.episodes.length);
                    }}
                    type="button"
                  >
                    {createEpisode.isPending ? 'Creating...' : '+ New Episode'}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex gap-4 overflow-x-auto pb-1">
                {project.episodes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-editor-border bg-black/10 px-5 py-8 text-sm text-zinc-500">
                    This project has no episodes yet.
                  </div>
                ) : (
                  project.episodes.map((episode) => {
                    const inputId = `episode-cover-${episode.id}`;
                    const isUploading = uploadingEpisodeId === episode.id;

                    return (
                      <article
                        key={episode.id}
                        className="group w-[190px] shrink-0 overflow-hidden rounded-[28px] border border-editor-border bg-editor-panelAlt/70 transition hover:border-editor-accentSoft hover:bg-editor-panelAlt"
                      >
                        <button
                          aria-label={`Open ${episode.title}`}
                          className="relative block aspect-[9/16] w-full overflow-hidden bg-black text-left"
                          onClick={() => navigate(`/promptoon/projects/${project.id}/episodes/${episode.id}`)}
                          type="button"
                        >
                          {episode.coverImageUrl ? (
                            <img alt={episode.title} className="h-full w-full object-cover" src={episode.coverImageUrl} />
                          ) : (
                            <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-4">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Recommended 9:16</p>
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">EP.{episode.episodeNo}</p>
                                <p className="mt-3 font-display text-xl font-semibold leading-tight text-zinc-100 transition group-hover:text-white">
                                  {episode.title}
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">EP.{episode.episodeNo}</p>
                            <p className="mt-2 line-clamp-2 font-display text-lg font-semibold leading-tight text-white">{episode.title}</p>
                            <p className="mt-2 text-xs text-white/55">
                              Status: <span className="text-white/80">{episode.status}</span>
                            </p>
                          </div>
                        </button>
                        <div className="space-y-2 p-3">
                          <input
                            accept="image/*"
                            className="sr-only"
                            disabled={isUploading}
                            id={inputId}
                            onChange={(event) => {
                              void handleEpisodeCoverUpload(project.id, episode.id, event.target.files?.[0] ?? null);
                              event.target.value = '';
                            }}
                            type="file"
                          />
                          <label
                            className={[
                              'block cursor-pointer rounded-2xl border border-editor-border px-4 py-2 text-center text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-white/5',
                              isUploading ? 'pointer-events-none opacity-60' : ''
                            ].join(' ')}
                            htmlFor={inputId}
                          >
                            {isUploading ? 'Uploading...' : episode.coverImageUrl ? 'Replace Cover' : 'Upload Cover'}
                          </label>
                          {episode.coverImageUrl ? (
                            <button
                              className="w-full rounded-2xl border border-editor-border px-4 py-2 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
                              disabled={updateEpisode.isPending}
                              onClick={() => {
                                void updateEpisode.mutateAsync({
                                  episodeId: episode.id,
                                  payload: {
                                    coverImageUrl: null
                                  }
                                });
                              }}
                              type="button"
                            >
                              Remove Cover
                            </button>
                          ) : null}
                          {uploadErrorByEpisodeId[episode.id] ? (
                            <p className="text-xs text-red-300">{uploadErrorByEpisodeId[episode.id]}</p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
