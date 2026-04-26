import type { ProjectWithEpisodes } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptoonProjectListPage } from '../src/pages/promptoon-project-list-page';

let projects: ProjectWithEpisodes[];
const uploadMutate = vi.fn<(_: { projectId: string; file: File }) => Promise<{ assetUrl: string }>>();
const updateEpisodeMutate = vi.fn<(_: { episodeId: string; payload: { coverImageUrl: string | null } }) => Promise<unknown>>();

vi.mock('../src/features/editor/hooks/use-episode-query', () => ({
  useUploadAsset: () => ({
    mutateAsync: uploadMutate
  })
}));

vi.mock('../src/features/project/hooks/use-project-query', () => ({
  useProjects: () => ({
    isLoading: false,
    isError: false,
    data: projects
  }),
  useCreateProject: () => ({
    isPending: false,
    mutateAsync: vi.fn()
  }),
  useCreateEpisode: () => ({
    isPending: false,
    mutateAsync: vi.fn()
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
  updateEpisodeMutate.mockReset();
  uploadMutate.mockResolvedValue({ assetUrl: '/uploads/cover.png' });
  updateEpisodeMutate.mockResolvedValue({});
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

describe('PromptoonProjectListPage cover upload', () => {
  it('renders the 9:16 cover empty state and saves uploaded covers', async () => {
    render(
      <MemoryRouter>
        <PromptoonProjectListPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Recommended 9:16')).toBeTruthy();

    const input = document.querySelector<HTMLInputElement>('#episode-cover-episode-1');
    expect(input).toBeTruthy();

    const file = new File(['cover'], 'cover.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, {
      target: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(uploadMutate).toHaveBeenCalledWith({ projectId: 'project-1', file });
    });
    expect(updateEpisodeMutate).toHaveBeenCalledWith({
      episodeId: 'episode-1',
      payload: {
        coverImageUrl: '/uploads/cover.png'
      }
    });
  });
});
