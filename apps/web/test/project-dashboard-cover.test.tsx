import type { ProjectWithEpisodes, PromptoonBackupExport } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudioProjectDetailPage } from '../src/domains/studio/pages/StudioProjectDetailPage';
import { StudioProjectSettingsPage } from '../src/domains/studio/pages/StudioProjectSettingsPage';
import { StudioPublishPage } from '../src/domains/studio/pages/StudioPublishPage';
import { PromptoonProjectListPage } from '../src/pages/promptoon-project-list-page';

let projects: ProjectWithEpisodes[];
const uploadMutate = vi.fn<(_: { projectId: string; file: File }) => Promise<{ assetUrl: string }>>();
const uploadProjectAssetMutate = vi.fn<(_: File) => Promise<{ assetUrl: string }>>();
const patchProjectMutate = vi.fn<
  (_: { title?: string; description?: string | null; thumbnailUrl?: string | null; isExperimental?: boolean }) => Promise<unknown>
>();
const updateEpisodeMutate = vi.fn<(_: { episodeId: string; payload: { coverImageUrl: string | null } }) => Promise<unknown>>();
const exportBackupMutate = vi.fn<() => Promise<PromptoonBackupExport>>();
const publishEpisodeMutate = vi.fn<(_: { projectId: string; episodeId: string }) => Promise<unknown>>();
const updatePublishedEpisodeMutate = vi.fn<(_: { projectId: string; episodeId: string }) => Promise<unknown>>();
const unpublishEpisodeMutate = vi.fn<(_: { projectId: string; episodeId: string }) => Promise<void>>();
const publishMovingtoonMutate = vi.fn<(_: string) => Promise<unknown>>();
const unpublishMovingtoonMutate = vi.fn<(_: string) => Promise<void>>();

vi.mock('../src/features/editor/hooks/use-episode-query', () => ({
  useUploadAsset: () => ({
    mutateAsync: uploadMutate
  }),
  usePublishEpisode: () => ({
    isPending: false,
    mutateAsync: publishEpisodeMutate
  }),
  useUpdatePublishedEpisode: () => ({
    isPending: false,
    mutateAsync: updatePublishedEpisodeMutate
  }),
  useUnpublishEpisode: () => ({
    isPending: false,
    mutateAsync: unpublishEpisodeMutate
  })
}));

vi.mock('../src/features/project/hooks/use-project-query', () => ({
  useProjects: () => ({
    isLoading: false,
    isError: false,
    data: projects
  }),
  usePatchProject: () => ({
    isPending: false,
    mutateAsync: patchProjectMutate
  }),
  useUploadProjectAsset: () => ({
    isPending: false,
    mutateAsync: uploadProjectAssetMutate
  }),
  useUploadQueue: () => ({
    data: {
      jobs: []
    }
  }),
  useCreateProject: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  }),
  useCreateEpisode: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  }),
  useCreateMovingtoonEpisode: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  }),
  usePublishMovingtoonEpisode: () => ({
    isPending: false,
    mutateAsync: publishMovingtoonMutate
  }),
  useUnpublishMovingtoonEpisode: () => ({
    isPending: false,
    mutateAsync: unpublishMovingtoonMutate
  }),
  useExportBackup: () => ({
    isPending: false,
    mutateAsync: exportBackupMutate
  }),
  useUpdateEpisode: () => ({
    isPending: false,
    mutateAsync: updateEpisodeMutate
  })
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  uploadMutate.mockReset();
  uploadProjectAssetMutate.mockReset();
  patchProjectMutate.mockReset();
  updateEpisodeMutate.mockReset();
  exportBackupMutate.mockReset();
  publishEpisodeMutate.mockReset();
  updatePublishedEpisodeMutate.mockReset();
  unpublishEpisodeMutate.mockReset();
  publishMovingtoonMutate.mockReset();
  unpublishMovingtoonMutate.mockReset();
  uploadMutate.mockResolvedValue({ assetUrl: '/uploads/cover.webp' });
  uploadProjectAssetMutate.mockResolvedValue({ assetUrl: '/uploads/project-cover.webp' });
  patchProjectMutate.mockResolvedValue({});
  updateEpisodeMutate.mockResolvedValue({});
  publishEpisodeMutate.mockResolvedValue({});
  updatePublishedEpisodeMutate.mockResolvedValue({});
  unpublishEpisodeMutate.mockResolvedValue();
  publishMovingtoonMutate.mockResolvedValue({});
  unpublishMovingtoonMutate.mockResolvedValue();
  exportBackupMutate.mockResolvedValue({
    schemaVersion: 1,
    exportedAt: '2026-04-29T10:00:00.000Z',
    ownerId: 'user-1',
    projects: [],
    totals: {
      projects: 0,
      episodes: 0,
      cuts: 0,
      choices: 0,
      publishes: 0,
      viewerEvents: 0
    }
  });
  projects = [
    {
      id: 'project-1',
      title: 'Project 1',
      description: null,
      thumbnailUrl: null,
      status: 'draft',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      episodes: [
        {
          id: 'episode-1',
          projectId: 'project-1',
          title: 'Episode 1',
          episodeNo: 1,
          coverImageUrl: null,
          startCutId: null,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    }
  ];
});

describe('PromptoonProjectListPage Studio dashboard', () => {
  it('downloads the current account backup as JSON', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <PromptoonProjectListPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Backup JSON' }));

    await waitFor(() => {
      expect(exportBackupMutate).toHaveBeenCalled();
    });
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('renders the Studio Home and movingtoon upload dialog shell', async () => {
    render(
      <MemoryRouter>
        <PromptoonProjectListPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Promptoon Studio')).toBeTruthy();
    expect(screen.queryByPlaceholderText('New project title')).toBeNull();
    expect(screen.getByText('Active Projects')).toBeTruthy();
    expect(screen.getAllByText('Project 1').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Updated')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Upload Movingtoon/i }));

    expect(screen.getByRole('heading', { name: 'Upload Movingtoon' })).toBeTruthy();
    expect(screen.getByText('Drop or choose a movingtoon video file')).toBeTruthy();
    expect(screen.getByText('Thumbnail will be generated during processing.')).toBeTruthy();
  });

  it('marks experimental projects in the Studio project list', () => {
    projects = [
      {
        ...projects[0],
        isExperimental: true
      }
    ];

    render(
      <MemoryRouter>
        <PromptoonProjectListPage />
      </MemoryRouter>
    );

    expect(screen.getByText('실험형')).toBeTruthy();
  });

  it('shows a movingtoon project as published when a movingtoon episode is published', () => {
    projects = [
      {
        ...projects[0],
        kind: 'movingtoon',
        status: 'draft',
        episodes: [],
        movingtoonEpisodes: [
          {
            id: 'movingtoon-episode-1',
            projectId: 'project-1',
            title: 'Movingtoon Episode 1',
            description: null,
            episodeNumber: 1,
            originalVideoUrl: '/uploads/original.mp4',
            videoAssetId: 'movingtoon-episode-1',
            videoUrl: '/uploads/movingtoon.mp4',
            thumbnailUrl: '/uploads/thumbnail.webp',
            durationSec: 15,
            aspectRatio: '9:16',
            processingStatus: 'ready',
            publishStatus: 'published',
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }
    ];

    render(
      <MemoryRouter>
        <PromptoonProjectListPage />
      </MemoryRouter>
    );

    expect(screen.getByText('MOVINGTOON')).toBeTruthy();
    expect(screen.getByText('published')).toBeTruthy();
  });

  it('renders movingtoon episodes on the Studio project detail page', () => {
    projects = [
      {
        ...projects[0],
        kind: 'movingtoon',
        status: 'draft',
        episodes: [],
        movingtoonEpisodes: [
          {
            id: 'movingtoon-episode-1',
            projectId: 'project-1',
            title: 'Movingtoon Episode 1',
            description: '첫 번째 무빙툰 에피소드',
            episodeNumber: 1,
            originalVideoUrl: '/uploads/original-1.mp4',
            videoAssetId: 'movingtoon-episode-1',
            videoUrl: '/uploads/movingtoon-1.mp4',
            thumbnailUrl: '/uploads/thumbnail-1.webp',
            durationSec: 15,
            aspectRatio: '9:16',
            processingStatus: 'ready',
            publishStatus: 'published',
            publishedAt: new Date('2026-05-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-05-02T00:00:00.000Z').toISOString()
          },
          {
            id: 'movingtoon-episode-2',
            projectId: 'project-1',
            title: 'Movingtoon Episode 2',
            description: null,
            episodeNumber: 2,
            originalVideoUrl: '/uploads/original-2.mp4',
            videoAssetId: 'movingtoon-episode-2',
            videoUrl: null,
            thumbnailUrl: null,
            durationSec: null,
            aspectRatio: '9:16',
            processingStatus: 'processing',
            publishStatus: 'draft',
            publishedAt: null,
            updatedAt: new Date('2026-05-03T00:00:00.000Z').toISOString()
          }
        ]
      }
    ];

    render(
      <MemoryRouter initialEntries={['/studio/projects/project-1']}>
        <Routes>
          <Route element={<StudioProjectDetailPage />} path="/studio/projects/:projectId" />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getAllByText('무빙툰 에피소드').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('무빙툰 2개, Ready 1개, Processing 1개, Failed 0개')).toBeTruthy();
    expect(screen.getByText('Movingtoon Episode 1')).toBeTruthy();
    expect(screen.getByText('Movingtoon Episode 2')).toBeTruthy();
    expect(screen.getAllByText('published').length).toBeGreaterThan(0);
    expect(screen.getByText('processing')).toBeTruthy();
    expect(screen.getByText('15s')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    expect(unpublishMovingtoonMutate).toHaveBeenCalledWith('movingtoon-episode-1');
    expect(screen.getByText('프롬툰 에피소드는 아직 없습니다. 위의 무빙툰 에피소드 목록에서 업로드 영상을 확인하세요.')).toBeTruthy();
    expect(screen.queryByText('아직 에피소드가 없습니다.')).toBeNull();
  });

  it('shows and uploads the project settings cover image', async () => {
    projects = [
      {
        ...projects[0],
        title: 'Project Settings',
        thumbnailUrl: '/uploads/current-cover.webp',
        description: null
      }
    ];

    render(
      <MemoryRouter initialEntries={['/studio/projects/project-1/settings']}>
        <Routes>
          <Route element={<StudioProjectSettingsPage />} path="/studio/projects/:projectId/settings" />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByAltText('현재 프로젝트 대표 이미지').getAttribute('src')).toBe('/uploads/current-cover.webp');
    expect(screen.queryByLabelText('실험형')).toBeNull();

    const fileInput = document.querySelector<HTMLInputElement>('#project-cover-upload');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['cover'], 'cover.png', { type: 'image/png' })]
      }
    });

    await waitFor(() => {
      expect(uploadProjectAssetMutate).toHaveBeenCalled();
    });
    expect(screen.getByDisplayValue('/uploads/project-cover.webp')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(patchProjectMutate).toHaveBeenCalledWith({
        title: 'Project Settings',
        description: null,
        thumbnailUrl: '/uploads/project-cover.webp'
      });
    });
  });

  it('lets platform admins toggle the experimental project setting', async () => {
    projects = [
      {
        ...projects[0],
        title: 'Project Settings',
        canManageExperimentalAccess: true,
        isExperimental: false
      }
    ];

    render(
      <MemoryRouter initialEntries={['/studio/projects/project-1/settings']}>
        <Routes>
          <Route element={<StudioProjectSettingsPage />} path="/studio/projects/:projectId/settings" />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('실험형'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(patchProjectMutate).toHaveBeenCalledWith({
        title: 'Project Settings',
        description: null,
        thumbnailUrl: null,
        isExperimental: true
      });
    });
  });

  it('manages movingtoon publish state on the Studio publish page', async () => {
    projects = [
      {
        ...projects[0],
        kind: 'movingtoon',
        status: 'published',
        episodes: [],
        movingtoonEpisodes: [
          {
            id: 'movingtoon-episode-1',
            projectId: 'project-1',
            title: 'Movingtoon Episode 1',
            description: null,
            episodeNumber: 1,
            originalVideoUrl: '/uploads/original-1.mp4',
            videoAssetId: 'movingtoon-episode-1',
            videoUrl: '/uploads/movingtoon-1.mp4',
            thumbnailUrl: null,
            durationSec: 15,
            aspectRatio: '9:16',
            processingStatus: 'ready',
            publishStatus: 'published',
            publishedAt: new Date('2026-05-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-05-02T00:00:00.000Z').toISOString()
          }
        ]
      }
    ];

    render(
      <MemoryRouter initialEntries={['/studio/projects/project-1/publish']}>
        <Routes>
          <Route element={<StudioPublishPage />} path="/studio/projects/:projectId/publish" />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('무빙툰 발행')).toBeTruthy();
    expect(screen.getByText('EP.1 Movingtoon Episode 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => {
      expect(unpublishMovingtoonMutate).toHaveBeenCalledWith('movingtoon-episode-1');
    });
  });
});
