import { startTransition, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCreateEpisode, useCreateProject, useProjects } from '../features/project/hooks/use-project-query';

function createEpisodeInputId(projectId: string): string {
  return `episode-title-${projectId}`;
}

export function PromptoonProjectListPage() {
  const navigate = useNavigate();
  const projectsQuery = useProjects();
  const createProject = useCreateProject();
  const createEpisode = useCreateEpisode();

  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [projectDescriptions, setProjectDescriptions] = useState<Record<string, string>>({});
  const [episodeTitlesByProjectId, setEpisodeTitlesByProjectId] = useState<Record<string, string>>({});

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
                  project.episodes.map((episode) => (
                    <button
                      key={episode.id}
                      className="group min-h-[132px] min-w-[200px] rounded-[28px] border border-editor-border bg-editor-panelAlt/70 p-5 text-left transition hover:border-editor-accentSoft hover:bg-editor-panelAlt"
                      onClick={() => navigate(`/promptoon/projects/${project.id}/episodes/${episode.id}`)}
                      type="button"
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">EP.{episode.episodeNo}</p>
                      <p className="mt-3 font-display text-xl font-semibold text-zinc-100 transition group-hover:text-white">
                        {episode.title}
                      </p>
                      <p className="mt-4 text-sm text-zinc-500">
                        Status: <span className="text-zinc-300">{episode.status}</span>
                      </p>
                    </button>
                  ))
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
