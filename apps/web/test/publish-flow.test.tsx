import type { EpisodeDraftResponse, Publish, ValidateEpisodeResponse } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { act } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorStore } from '../src/features/editor/store/use-editor-store';
import { PromptoonEpisodeEditorPage } from '../src/pages/promptoon-episode-editor-page';
import { ValidationModal } from '../src/widgets/publish-flow/ValidationModal';

let draftResponse: EpisodeDraftResponse;
let analyticsData: {
  totalViews: number;
  uniqueViewers: number;
  completionRate: number;
  replayRate: number;
  funnel: Array<{ key: 'start_view' | 'choice_engaged' | 'ending_reached'; label: string; viewers: number }>;
  cutEngagement: Array<{ cutId: string; dropOffCount: number; avgDurationMs: number }>;
  choiceStats: Record<string, Array<{ choiceId: string; label: string; count: number; percentage: number; avgHesitationMs?: number }>>;
  endingDistribution: Array<{ cutId: string; count: number; percentage: number }>;
  dailyViews: Array<{ date: string; views: number }>;
  feedEntry: { impressions: number; choiceClicks: number; conversionRate: number };
};
const validateMutate = vi.fn<(_: string) => Promise<ValidateEpisodeResponse>>();
const publishMutate = vi.fn<(_: { projectId: string; episodeId: string }) => Promise<Publish>>();
const updatePublishMutate = vi.fn<(_: { projectId: string; episodeId: string }) => Promise<Publish>>();
const unpublishMutate = vi.fn<(_: { projectId: string; episodeId: string }) => Promise<void>>();
const uploadMutate = vi.fn<(_: { projectId: string; file: File }) => Promise<{ assetUrl: string }>>();
const createCutMutate = vi.fn();
const createChoiceMutate = vi.fn();
const reorderCutsMutate = vi.fn();
const saveCutLayoutMutate = vi.fn();
const updateCutMutate = vi.fn();
const updateChoiceMutate = vi.fn();
const queueCutPatch = vi.fn();

vi.mock('../src/features/analytics/hooks/use-episode-analytics', () => ({
  useEpisodeAnalytics: () => ({
    isLoading: false,
    isError: false,
    data: analyticsData
  })
}));

vi.mock('../src/features/editor/hooks/use-cut-autosave', () => ({
  useCutAutosave: () => ({
    queueCutPatch
  })
}));

vi.mock('../src/features/editor/hooks/use-choice-autosave', () => ({
  useChoiceAutosave: () => ({
    queueChoicePatch: vi.fn()
  })
}));

vi.mock('../src/features/editor/hooks/use-episode-query', () => ({
  useEpisodeDraft: () => ({
    isError: false,
    isLoading: false,
    data: draftResponse
  }),
  useLatestPublishedEpisode: () => ({
    isError: false,
    isLoading: false,
    data: null
  }),
  useCreateChoice: () => ({
    mutateAsync: createChoiceMutate
  }),
  useCreateCut: () => ({
    mutateAsync: createCutMutate
  }),
  useDeleteChoice: () => ({
    mutateAsync: vi.fn()
  }),
  useDeleteCut: () => ({
    mutateAsync: vi.fn()
  }),
  useUploadAsset: () => ({
    mutateAsync: uploadMutate
  }),
  useUpdateCut: () => ({
    isPending: false,
    mutate: updateCutMutate,
    mutateAsync: updateCutMutate
  }),
  useUpdateChoice: () => ({
    isPending: false,
    mutate: updateChoiceMutate
  }),
  useReorderCuts: () => ({
    isPending: false,
    mutateAsync: reorderCutsMutate
  }),
  useSaveCutLayout: () => ({
    isPending: false,
    mutateAsync: saveCutLayoutMutate
  }),
  useValidateEpisode: () => ({
    isPending: false,
    mutateAsync: validateMutate
  }),
  usePublishEpisode: () => ({
    isPending: false,
    mutateAsync: publishMutate
  }),
  useUpdatePublishedEpisode: () => ({
    isPending: false,
    mutateAsync: updatePublishMutate
  }),
  useUnpublishEpisode: () => ({
    isPending: false,
    mutateAsync: unpublishMutate
  })
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useEditorStore.getState().resetForEpisode();
  validateMutate.mockReset();
  publishMutate.mockReset();
  updatePublishMutate.mockReset();
  unpublishMutate.mockReset();
  uploadMutate.mockReset();
  createCutMutate.mockReset();
  createChoiceMutate.mockReset();
  reorderCutsMutate.mockReset();
  saveCutLayoutMutate.mockReset();
  updateCutMutate.mockReset();
  updateChoiceMutate.mockReset();
  queueCutPatch.mockReset();
  draftResponse = {
    episode: {
      id: 'episode-1',
      projectId: 'project-1',
      title: 'Episode 1',
      episodeNo: 1,
      startCutId: 'cut-1',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    cuts: [
      {
        id: 'cut-1',
        episodeId: 'episode-1',
        kind: 'choice',
        title: 'Opening',
        body: 'Choose a route.',
        contentBlocks: [],
        dialogAnchorX: 'left',
        dialogAnchorY: 'bottom',
        dialogOffsetX: 0,
        dialogOffsetY: 0,
        dialogTextAlign: 'left',
        startEffect: 'none',
        endEffect: 'none',
        startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
        endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
        assetUrl: null,
        positionX: 0,
        positionY: 100,
        orderIndex: 0,
        isStart: true,
        isEnding: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'cut-2',
        episodeId: 'episode-1',
        kind: 'ending',
        title: 'Ending',
        body: 'Done.',
        contentBlocks: [],
        dialogAnchorX: 'left',
        dialogAnchorY: 'bottom',
        dialogOffsetX: 0,
        dialogOffsetY: 0,
        dialogTextAlign: 'left',
        startEffect: 'none',
        endEffect: 'none',
        startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
        endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
        assetUrl: null,
        positionX: 200,
        positionY: 100,
        orderIndex: 1,
        isStart: false,
        isEnding: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    choices: [
      {
        id: 'choice-1',
        cutId: 'cut-1',
        label: 'Go',
        orderIndex: 0,
        nextCutId: 'cut-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };
  createCutMutate.mockResolvedValue({
    id: 'cut-new',
    episodeId: 'episode-1',
    kind: 'scene',
    title: 'Cut 3',
    body: '',
    contentBlocks: [],
    dialogAnchorX: 'left',
    dialogAnchorY: 'bottom',
    dialogOffsetX: 0,
    dialogOffsetY: 0,
    dialogTextAlign: 'left',
    startEffect: 'none',
    endEffect: 'none',
    startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
    endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
    assetUrl: null,
    edgeFade: 'both',
    edgeFadeIntensity: 'minimal',
    positionX: 400,
    positionY: 100,
    orderIndex: 2,
    isStart: false,
    isEnding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  updateCutMutate.mockResolvedValue({
    ...draftResponse.cuts[1],
    kind: 'scene',
    isEnding: false
  });
  createChoiceMutate.mockResolvedValue({
    id: 'choice-new',
    cutId: 'cut-2',
    label: 'Choice 1',
    orderIndex: 0,
    nextCutId: 'cut-new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  reorderCutsMutate.mockResolvedValue({
    cuts: [
      draftResponse.cuts[0],
      draftResponse.cuts[1],
      {
        id: 'cut-new',
        episodeId: 'episode-1',
        kind: 'scene',
        title: 'Cut 3',
        body: '',
        contentBlocks: [],
        dialogAnchorX: 'left',
        dialogAnchorY: 'bottom',
        dialogOffsetX: 0,
        dialogOffsetY: 0,
        dialogTextAlign: 'left',
        startEffect: 'none',
        endEffect: 'none',
        startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
        endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
        assetUrl: null,
        edgeFade: 'both',
        edgeFadeIntensity: 'minimal',
        positionX: 400,
        positionY: 100,
        orderIndex: 2,
        isStart: false,
        isEnding: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  });
  saveCutLayoutMutate.mockResolvedValue({
    cuts: []
  });
  analyticsData = {
    totalViews: 1250,
    uniqueViewers: 840,
    completionRate: 65.4,
    replayRate: 12.5,
    funnel: [
      { key: 'start_view', label: '시작', viewers: 840 },
      { key: 'choice_engaged', label: '선택', viewers: 700 },
      { key: 'ending_reached', label: '엔딩', viewers: 549 }
    ],
    cutEngagement: [
      { cutId: 'cut-1', dropOffCount: 18, avgDurationMs: 9300 },
      { cutId: 'cut-2', dropOffCount: 3, avgDurationMs: 4200 }
    ],
    choiceStats: {
      'cut-1': [
        { choiceId: 'choice-1', label: 'Go', count: 600, percentage: 75, avgHesitationMs: 2400 },
        { choiceId: 'choice-2', label: 'Stay', count: 200, percentage: 25, avgHesitationMs: 5100 }
      ],
      'cut-single': [
        { choiceId: 'choice-single', label: 'Continue', count: 120, percentage: 100 }
      ]
    },
    endingDistribution: [
      { cutId: 'cut-2', count: 549, percentage: 100 }
    ],
    dailyViews: [
      { date: '2026-03-12', views: 20 },
      { date: '2026-03-13', views: 35 }
    ],
    feedEntry: {
      impressions: 900,
      choiceClicks: 420,
      conversionRate: 46.7
    }
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/promptoon/projects/project-1/episodes/episode-1']}>
      <Routes>
        <Route path="/promptoon/projects/:projectId/episodes/:episodeId" element={<PromptoonEpisodeEditorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('publish flow', () => {
  it('blocks publish while reorder is dirty and highlights save order', async () => {
    renderPage();
    act(() => {
      useEditorStore.getState().markDirty(true);
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    });

    expect(validateMutate).not.toHaveBeenCalled();
    expect((await screen.findAllByText('먼저 변경사항을 저장해 주세요')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save Order' }).className.includes('animate-bounce')).toBe(true);
  });

  it('opens the script modal and disables apply for invalid JSON', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Script' }));
    const textarea = await screen.findByLabelText('Script JSON editor');

    expect((textarea as HTMLTextAreaElement).value).toContain('"cutId": "cut-1"');

    fireEvent.change(textarea, { target: { value: '{' } });

    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Fix JSON errors before applying/i)).toBeTruthy();
    expect(screen.getByText(/Expected property name|Unexpected/i)).toBeTruthy();
  });

  it('loads script JSON from an uploaded file', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Script' }));
    const textarea = await screen.findByLabelText('Script JSON editor');
    const input = screen.getByLabelText('Upload script JSON file') as HTMLInputElement;
    const file = new File(
      [
        JSON.stringify([
          {
            cutId: 'cut-1',
            cutTitle: 'Uploaded',
            blocks: []
          }
        ])
      ],
      'script.json',
      { type: 'application/json' }
    );

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toContain('"cutTitle":"Uploaded"');
    });
  });

  it('applies valid script JSON through cut autosave patches and keeps unknown id warnings non-blocking', async () => {
    draftResponse.cuts[0] = {
      ...draftResponse.cuts[0],
      body: 'Old line',
      contentBlocks: [
        {
          id: 'dialogue-1',
          type: 'dialogue',
          speaker: 'Hero',
          text: 'Old line',
          textAlign: 'left',
          fontToken: 'sans-kr',
          fontSizeToken: 'lg',
          placement: 'overlay'
        }
      ]
    };
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Script' }));
    const textarea = await screen.findByLabelText('Script JSON editor');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify(
          [
            {
              cutId: 'cut-1',
              cutTitle: 'Ignored title',
              blocks: [
                {
                  blockId: 'dialogue-1',
                  type: 'dialogue',
                  speaker: 'Guide',
                  text: 'New line'
                },
                {
                  blockId: 'missing-block',
                  type: 'dialogue',
                  text: 'Skipped'
                }
              ]
            }
          ],
          null,
          2
        )
      }
    });

    expect(screen.getByText('Unknown blockId skipped in Opening: missing-block')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(queueCutPatch).toHaveBeenCalledWith('cut-1', {
        body: 'New line',
        contentBlocks: [
          {
            id: 'dialogue-1',
            type: 'dialogue',
            speaker: 'Guide',
            text: 'New line',
            textAlign: 'left',
            fontToken: 'sans-kr',
            fontSizeToken: 'lg',
            placement: 'overlay'
          }
        ]
      });
    });
  });

  it('creates a new cut after the selected cut without linking it automatically', async () => {
    renderPage();

    fireEvent.click(screen.getAllByText('Ending')[0]);
    fireEvent.click(screen.getByRole('button', { name: '+ Cut' }));

    await waitFor(() => {
      expect(createCutMutate).toHaveBeenCalledWith({
        kind: 'scene',
        title: 'Cut 3',
        body: '',
        startEffect: 'none',
        endEffect: 'none',
        edgeFade: 'both',
        edgeFadeIntensity: 'minimal',
        positionX: 210,
        positionY: 110
      });
    });

    expect(updateCutMutate).not.toHaveBeenCalled();
    expect(createChoiceMutate).not.toHaveBeenCalled();
    expect(reorderCutsMutate).toHaveBeenCalledWith({
      cuts: [
        { cutId: 'cut-1', orderIndex: 0 },
        { cutId: 'cut-2', orderIndex: 1 },
        { cutId: 'cut-new', orderIndex: 2 }
      ]
    });
  });

  it('creates a new cut directly below the cut card add button anchor', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Add cut after Opening' }));

    await waitFor(() => {
      expect(createCutMutate).toHaveBeenCalledWith({
        kind: 'scene',
        title: 'Cut 3',
        body: '',
        startEffect: 'none',
        endEffect: 'none',
        edgeFade: 'both',
        edgeFadeIntensity: 'minimal',
        positionX: 200,
        positionY: 360
      });
    });

    expect(updateCutMutate).not.toHaveBeenCalled();
    expect(createChoiceMutate).not.toHaveBeenCalled();
    expect(reorderCutsMutate).toHaveBeenCalledWith({
      cuts: [
        { cutId: 'cut-1', orderIndex: 0 },
        { cutId: 'cut-2', orderIndex: 1 },
        { cutId: 'cut-new', orderIndex: 2 }
      ]
    });
  });

  it('shows the immediate next cut effect when a preview choice points into a single-path scene chain', async () => {
    const middleCut = {
      ...draftResponse.cuts[1],
      id: 'cut-middle',
      kind: 'scene' as const,
      title: 'Middle',
      body: 'Lazy middle body',
      startEffect: 'zoom-in' as const,
      startEffectDurationMs: 1000,
      orderIndex: 1,
      isEnding: false
    };
    const branchCut = {
      ...draftResponse.cuts[1],
      id: 'cut-branch',
      kind: 'choice' as const,
      title: 'Branch',
      body: 'Branch body',
      orderIndex: 2,
      isEnding: false
    };
    const endingCut = {
      ...draftResponse.cuts[1],
      orderIndex: 3
    };

    draftResponse = {
      ...draftResponse,
      cuts: [draftResponse.cuts[0], middleCut, branchCut, endingCut],
      choices: [
        {
          ...draftResponse.choices[0],
          nextCutId: 'cut-middle'
        },
        {
          id: 'choice-middle',
          cutId: 'cut-middle',
          label: 'Continue',
          orderIndex: 0,
          nextCutId: 'cut-branch',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));

    await waitFor(() => {
      const preview = screen.getByTestId('preview-cut-motion');
      expect(preview.getAttribute('data-start-effect')).toBe('zoom-in');
      expect(preview.getAttribute('data-start-effect-duration-ms')).toBe('1000');
      expect(within(preview).getByText('Lazy middle body')).toBeTruthy();
      expect(within(preview).queryByText('Branch body')).toBeNull();
    });
  });

  it('creates and links a graph placeholder cut under the selected branch end', async () => {
    draftResponse = {
      ...draftResponse,
      cuts: [
        draftResponse.cuts[0],
        {
          ...draftResponse.cuts[1],
          kind: 'scene',
          isEnding: false
        }
      ]
    };
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Graph' }));
    fireEvent.click(await screen.findByTestId('graph-add-placeholder-button-cut-2'));

    await waitFor(() => {
      expect(createCutMutate).toHaveBeenCalledWith({
        kind: 'scene',
        title: 'Cut 3',
        body: '',
        startEffect: 'none',
        endEffect: 'none',
        edgeFade: 'both',
        edgeFadeIntensity: 'minimal',
        positionX: 200,
        positionY: 360
      });
    });

    expect(reorderCutsMutate).toHaveBeenCalledWith({
      cuts: [
        { cutId: 'cut-1', orderIndex: 0 },
        { cutId: 'cut-2', orderIndex: 1 },
        { cutId: 'cut-new', orderIndex: 2 }
      ]
    });
    expect(createChoiceMutate).toHaveBeenCalledWith({
      cutId: 'cut-2',
      payload: {
        label: 'Choice 1',
        nextCutId: 'cut-new'
      }
    });
  });

  it('saves graph alignment through the layout endpoint instead of immediate cut patches', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Graph' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vertical' }));

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Save Layout' }) as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }));

    await waitFor(() => {
      expect(saveCutLayoutMutate).toHaveBeenCalledWith({
        cuts: [
          { cutId: 'cut-1', positionX: 0, positionY: 0 },
          { cutId: 'cut-2', positionX: 0, positionY: 260 }
        ]
      });
    });
    expect(updateCutMutate).not.toHaveBeenCalled();
    expect(reorderCutsMutate).not.toHaveBeenCalled();
  });

  it('renders validation issues in the modal', async () => {
    validateMutate.mockResolvedValue({
      isValid: false,
      errors: [{ code: 'missing_start_cut', message: '시작 컷이 지정되지 않았습니다.' }],
      warnings: [{ code: 'unreachable_cut', message: '도달할 수 없는 컷이 존재합니다.' }]
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));

    expect(await screen.findByText('Validation Report')).toBeTruthy();
    expect(screen.getByText('시작 컷이 지정되지 않았습니다.')).toBeTruthy();
    expect(screen.getByText('도달할 수 없는 컷이 존재합니다.')).toBeTruthy();
  });

  it('validates first and publishes from the modal confirm action', async () => {
    validateMutate.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [{ code: 'unreachable_cut', message: '도달할 수 없는 컷이 존재합니다.' }]
    });
    publishMutate.mockResolvedValue({
      id: 'publish-1',
      projectId: 'project-1',
      episodeId: 'episode-1',
      versionNo: 3,
      status: 'published',
      manifest: {
        project: {
          id: 'project-1',
          title: 'Project',
          description: null,
          thumbnailUrl: null,
          status: 'draft'
        },
        episode: {
          id: 'episode-1',
          title: 'Episode 1',
          episodeNo: 1,
          status: 'draft',
          startCutId: 'cut-1'
        },
        cuts: []
      },
      createdBy: 'user-1',
      createdAt: new Date().toISOString()
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByRole('button', { name: '바로 발행하기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '바로 발행하기' }));

    await waitFor(() => {
      expect(publishMutate).toHaveBeenCalledWith({ projectId: 'project-1', episodeId: 'episode-1' });
    });

    expect(await screen.findByText('성공적으로 발행되었습니다')).toBeTruthy();
    expect(screen.getByText('Version 3 is now live.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Open Viewer' })[0].getAttribute('href')).toBe('/v/publish-1');
    expect(screen.getByText('Publish: v3 live')).toBeTruthy();
  });

  it('validates first and updates the existing publish when the episode is already published', async () => {
    draftResponse = {
      ...draftResponse,
      episode: {
        ...draftResponse.episode,
        status: 'published'
      }
    };
    validateMutate.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: []
    });
    updatePublishMutate.mockResolvedValue({
      id: 'publish-existing',
      projectId: 'project-1',
      episodeId: 'episode-1',
      versionNo: 2,
      status: 'published',
      manifest: {
        project: {
          id: 'project-1',
          title: 'Project',
          description: null,
          thumbnailUrl: null,
          status: 'published'
        },
        episode: {
          id: 'episode-1',
          title: 'Episode 1',
          episodeNo: 1,
          status: 'published',
          startCutId: 'cut-1'
        },
        cuts: []
      },
      createdBy: 'user-1',
      createdAt: new Date().toISOString()
    });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Update Publish' }));

    expect(await screen.findByRole('button', { name: '바로 발행하기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '바로 발행하기' }));

    await waitFor(() => {
      expect(updatePublishMutate).toHaveBeenCalledWith({ projectId: 'project-1', episodeId: 'episode-1' });
    });

    expect(validateMutate).toHaveBeenCalledWith('episode-1');
    expect(publishMutate).not.toHaveBeenCalled();
    expect(unpublishMutate).not.toHaveBeenCalled();
    expect(await screen.findByText('Version 2 is now live.')).toBeTruthy();
  });

  it('switches to the analytics tab and renders summary cards', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '분석' }));

    expect(await screen.findByText('총 조회수')).toBeTruthy();
    expect(screen.getByText('1,250')).toBeTruthy();
    expect(screen.getByText('840')).toBeTruthy();
    expect(screen.getByText('65.4%')).toBeTruthy();
    expect(screen.getByText('12.5%')).toBeTruthy();
    expect(screen.getByText('선택지 비율 · Opening')).toBeTruthy();
    expect(screen.queryByText('선택지 비율 · cut-single')).toBeNull();
    expect(screen.getByText('Ending Distribution')).toBeTruthy();
    expect(screen.getByText('Cut Engagement')).toBeTruthy();
    expect(screen.getByText(/2.4s/)).toBeTruthy();
  });

  it('uploads images with the current project id', async () => {
    uploadMutate.mockResolvedValue({
      assetUrl: '/uploads/2026/04/03/project-1/cover-1234.png'
    });

    const { container } = renderPage();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake'], 'cover.png', { type: 'image/png' });

    expect(fileInput).not.toBeNull();

    await act(async () => {
      fireEvent.change(fileInput, {
        target: {
          files: [file]
        }
      });
    });

    await waitFor(() => {
      expect(uploadMutate).toHaveBeenCalledWith({ projectId: 'project-1', file });
    });
  });
});

describe('ValidationModal', () => {
  it('disables the publish confirm button while publishing and keeps scroll container classes', () => {
    const { container } = render(
      <ValidationModal
        isOpen
        isPublishing
        onClose={vi.fn()}
        onPublish={vi.fn()}
        result={{
          isValid: true,
          errors: [],
          warnings: [{ code: 'unreachable_cut', message: '경고가 있습니다.' }]
        }}
      />
    );

    expect((screen.getByRole('button', { name: '발행 중...' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('경고가 있습니다.')).toBeTruthy();
    expect(container.querySelector('.overflow-y-auto')).not.toBeNull();
  });
});
