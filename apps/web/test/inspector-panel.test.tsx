import type { Choice, Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { act } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CutEditorForm } from '../src/widgets/inspector-panel/CutEditorForm';
import { InspectorPanel } from '../src/widgets/inspector-panel/InspectorPanel';

afterEach(() => {
  cleanup();
});

function buildCut(id: string, overrides?: Partial<Cut>): Cut {
  return {
    id,
    episodeId: 'episode-1',
    kind: 'scene',
    title: `Cut ${id}`,
    body: 'Default body',
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
    isStart: false,
    isEnding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function buildChoice(id: string, cutId: string, overrides?: Partial<Choice>): Choice {
  return {
    id,
    cutId,
    label: `Choice ${id}`,
    orderIndex: 0,
    nextCutId: null,
    afterSelectReactionText: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('InspectorPanel', () => {
  it('shows the improved empty state when no cut is selected', () => {
    render(
      <InspectorPanel
        choices={[]}
        cuts={[]}
        onCreateChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onUploadAsset={vi.fn()}
        onSelectChoice={vi.fn()}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        pendingAutosaveCount={0}
        selectedChoice={null}
        selectedCut={null}
      />
    );

    expect(screen.getByText('Inspector Ready')).toBeTruthy();
    expect(screen.getByText(/좌측 리스트에서 컷을 선택하여 편집하세요/)).toBeTruthy();
  });

  it('renders the choice editor section for scene and choice cuts, but not transition cuts', () => {
    const cut = buildCut('cut-1', { kind: 'choice' });
    const nextCut = buildCut('cut-2', { title: 'Next scene' });
    const choice = buildChoice('choice-1', cut.id);

    const { rerender } = render(
      <InspectorPanel
        choices={[choice]}
        cuts={[cut, nextCut]}
        onCreateChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onUploadAsset={vi.fn()}
        onSelectChoice={vi.fn()}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        pendingAutosaveCount={0}
        selectedChoice={choice}
        selectedCut={cut}
      />
    );

    expect(screen.getByText('Choices')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Next scene' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: cut.title })).toBeNull();

    rerender(
      <InspectorPanel
        choices={[choice]}
        cuts={[{ ...cut, kind: 'scene' }, nextCut]}
        onCreateChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onUploadAsset={vi.fn()}
        onSelectChoice={vi.fn()}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        pendingAutosaveCount={0}
        selectedChoice={null}
        selectedCut={{ ...cut, kind: 'scene' }}
      />
    );

    expect(screen.getByText('Choices')).toBeTruthy();

    rerender(
      <InspectorPanel
        choices={[]}
        cuts={[{ ...cut, kind: 'scene' }, nextCut]}
        onCreateChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onUploadAsset={vi.fn()}
        onSelectChoice={vi.fn()}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        pendingAutosaveCount={0}
        selectedChoice={null}
        selectedCut={{ ...cut, kind: 'scene' }}
      />
    );

    expect(screen.getByText('Choices')).toBeTruthy();

    rerender(
      <InspectorPanel
        choices={[]}
        cuts={[{ ...cut, kind: 'transition' }, nextCut]}
        onCreateChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onUploadAsset={vi.fn()}
        onSelectChoice={vi.fn()}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        pendingAutosaveCount={0}
        selectedChoice={null}
        selectedCut={{ ...cut, kind: 'transition' }}
      />
    );

    expect(screen.queryByText('Choices')).toBeNull();
  });
});

describe('CutEditorForm', () => {
  it('debounces rapid typing into a single patch emission', async () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    const bodyInput = screen.getByDisplayValue('Default body');
    act(() => {
      fireEvent.change(bodyInput, {
        target: {
          value: 'U'
        }
      });
    });

    act(() => {
      fireEvent.change(bodyInput, {
        target: {
          value: 'Updated'
        }
      });
    });

    act(() => {
      fireEvent.change(bodyInput, {
        target: {
          value: 'Updated body text'
        }
      });
    });

    expect(onQueuePatch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledTimes(1);
    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Updated body text',
      contentBlocks: [
        {
          id: 'cut-1-legacy-body',
          type: 'narration',
          text: 'Updated body text',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        }
      ]
    });

    vi.useRealTimers();
  });

  it('uploads an image file and persists the asset immediately', async () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const onCommitPatch = vi.fn().mockResolvedValue(undefined);
    const onUploadAsset = vi.fn().mockResolvedValue('/uploads/cover.png');
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={onCommitPatch}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={onUploadAsset}
        pendingAutosaveCount={0}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake'], 'cover.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, {
        target: {
          files: [file]
        }
      });
    });

    expect(onUploadAsset).toHaveBeenCalledWith(file);
    expect(onCommitPatch).toHaveBeenCalledWith('cut-1', { assetUrl: '/uploads/cover.png' });
    expect(onQueuePatch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onQueuePatch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('queues content view mode changes from the content blocks settings', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.change(screen.getByLabelText('View Style'), {
      target: {
        value: 'inverse'
      }
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      contentViewMode: 'inverse'
    });

    vi.useRealTimers();
  });

  it('applies toolbar align and font changes to the selected text block only', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1', {
      contentBlocks: [
        {
          id: 'block-1',
          type: 'heading',
          text: 'Heading',
          textAlign: 'center',
          fontToken: 'display'
        },
        {
          id: 'block-2',
          type: 'narration',
          text: 'Narration',
          textAlign: 'left',
          fontToken: 'sans-kr'
        }
      ]
    });

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.focus(screen.getAllByLabelText('Block Text')[1]);
    fireEvent.change(screen.getByLabelText('Block Align'), { target: { value: 'right' } });
    fireEvent.change(screen.getByLabelText('Block Font'), { target: { value: 'serif-kr' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Heading\n\nNarration',
      contentBlocks: [
        {
          id: 'block-1',
          type: 'heading',
          text: 'Heading',
          textAlign: 'center',
          fontToken: 'display'
        },
        {
          id: 'block-2',
          type: 'narration',
          text: 'Narration',
          textAlign: 'right',
          fontToken: 'serif-kr'
        }
      ]
    });

    vi.useRealTimers();
  });

  it('inserts a block from the inline insert line', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Insert block' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Heading' }));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Default body',
      contentBlocks: expect.arrayContaining([
        {
          id: 'cut-1-legacy-body',
          type: 'narration',
          text: 'Default body',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        },
        expect.objectContaining({
          type: 'heading',
          text: '',
          textAlign: 'center',
          fontToken: 'display',
          placement: 'flow',
          fontSizeToken: '2xl'
        })
      ])
    });

    vi.useRealTimers();
  });

  it('queues placement changes for selected text blocks only', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1', {
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: 'Narration',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        }
      ]
    });

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.change(screen.getByLabelText('Block Placement'), { target: { value: 'overlay' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Narration',
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: 'Narration',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay'
        }
      ]
    });

    vi.useRealTimers();
  });

  it('creates dialogue blocks with overlay defaults and persists speaker edits', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Insert block' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Dialogue' }));

    fireEvent.change(screen.getByLabelText('Dialogue Speaker'), { target: { value: 'Hero' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Default body',
      contentBlocks: expect.arrayContaining([
        {
          id: 'cut-1-legacy-body',
          type: 'narration',
          text: 'Default body',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        },
        expect.objectContaining({
          type: 'dialogue',
          speaker: 'Hero',
          placement: 'overlay',
          fontSizeToken: 'lg'
        })
      ])
    });

    vi.useRealTimers();
  });

  it('queues font size changes for selected text blocks only', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1', {
      contentBlocks: [
        {
          id: 'block-1',
          type: 'heading',
          text: 'Heading',
          textAlign: 'center',
          fontToken: 'display',
          fontSizeToken: '2xl'
        }
      ]
    });

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.change(screen.getByLabelText('Block Font Size'), { target: { value: '3xl' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Heading',
      contentBlocks: [
        {
          id: 'block-1',
          type: 'heading',
          text: 'Heading',
          textAlign: 'center',
          fontToken: 'display',
          fontSizeToken: '3xl'
        }
      ]
    });

    vi.useRealTimers();
  });

  it('queues rhythm style changes for cuts and selected text blocks', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1', {
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: 'Narration',
          textAlign: 'left',
          fontToken: 'sans-kr',
          lineHeightToken: 'normal',
          marginTopToken: 'none',
          marginBottomToken: 'none'
        }
      ]
    });

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    fireEvent.change(screen.getByLabelText('Edge Fade'), { target: { value: 'both' } });
    fireEvent.change(screen.getByLabelText('Edge Fade Intensity'), { target: { value: 'strong' } });
    fireEvent.change(screen.getByLabelText('Edge Fade Color'), { target: { value: 'white' } });
    fireEvent.change(screen.getByLabelText('Cut Bottom Spacing'), { target: { value: 'xl' } });
    fireEvent.change(screen.getByLabelText('Block Line Height'), { target: { value: 'loose' } });
    fireEvent.change(screen.getByLabelText('Block Top Spacing'), { target: { value: 'sm' } });
    fireEvent.change(screen.getByLabelText('Block Bottom Spacing'), { target: { value: 'lg' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      body: 'Narration',
      edgeFade: 'both',
      edgeFadeIntensity: 'strong',
      edgeFadeColor: 'white',
      marginBottomToken: 'xl',
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: 'Narration',
          textAlign: 'left',
          fontToken: 'sans-kr',
          lineHeightToken: 'loose',
          marginTopToken: 'sm',
          marginBottomToken: 'lg'
        }
      ]
    });

    vi.useRealTimers();
  });

  it('queues dialogue position changes with safe numeric offsets', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    const horizontalSelect = screen.getByRole('combobox', { name: 'Horizontal' });
    const verticalSelect = screen.getByRole('combobox', { name: 'Vertical' });
    const textAlignSelect = screen.getByRole('combobox', { name: 'Text Align' });
    const xInput = screen.getByRole('spinbutton', { name: 'X' });
    const yInput = screen.getByRole('spinbutton', { name: 'Y' });

    expect(within(horizontalSelect).getByRole('option', { name: 'Center' })).toBeTruthy();
    expect(within(verticalSelect).getByRole('option', { name: 'Top' })).toBeTruthy();
    expect(within(verticalSelect).getByRole('option', { name: 'Upper' })).toBeTruthy();
    expect(within(verticalSelect).getByRole('option', { name: 'Center' })).toBeTruthy();
    expect(within(verticalSelect).getByRole('option', { name: 'Lower' })).toBeTruthy();
    expect(within(verticalSelect).getByRole('option', { name: 'Bottom' })).toBeTruthy();

    fireEvent.change(horizontalSelect, { target: { value: 'center' } });
    fireEvent.change(verticalSelect, { target: { value: 'lower' } });
    fireEvent.change(textAlignSelect, { target: { value: 'center' } });
    fireEvent.change(xInput, { target: { value: '24' } });
    fireEvent.change(yInput, { target: { value: '36' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      dialogAnchorX: 'center',
      dialogAnchorY: 'lower',
      dialogOffsetX: 24,
      dialogOffsetY: 36,
      dialogTextAlign: 'center'
    });

    vi.useRealTimers();
  });

  it('does not apply a stale kind patch to a newly selected cut', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cutA = buildCut('cut-a', { title: 'Cut A', kind: 'scene' });
    const cutB = buildCut('cut-b', { title: 'Cut B', kind: 'scene' });

    const { rerender } = render(
      <CutEditorForm
        cut={cutA}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    const kindSelect = screen.getByRole('combobox', { name: 'Kind' });

    fireEvent.change(kindSelect, {
      target: {
        value: 'choice'
      }
    });

    rerender(
      <CutEditorForm
        cut={cutB}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onQueuePatch).not.toHaveBeenCalledWith('cut-b', expect.objectContaining({ kind: 'choice' }));
    vi.useRealTimers();
  });

  it('shows default effect durations and queues effect and duration changes', () => {
    vi.useFakeTimers();
    const onQueuePatch = vi.fn();
    const cut = buildCut('cut-1');

    render(
      <CutEditorForm
        cut={cut}
        onCommitPatch={vi.fn().mockResolvedValue(undefined)}
        onDeleteCut={vi.fn()}
        onKindPreviewChange={vi.fn()}
        onQueuePatch={onQueuePatch}
        onUploadAsset={vi.fn()}
        pendingAutosaveCount={0}
      />
    );

    const startEffectSelect = screen.getByRole('combobox', { name: 'Start Effect' });
    const startDurationInput = screen.getByRole('spinbutton', { name: 'Start Duration' });
    const endEffectSelect = screen.getByRole('combobox', { name: 'End Effect' });
    const endDurationInput = screen.getByRole('spinbutton', { name: 'End Duration' });

    expect((startEffectSelect as HTMLSelectElement).value).toBe('none');
    expect((endEffectSelect as HTMLSelectElement).value).toBe('none');
    expect((startDurationInput as HTMLInputElement).value).toBe(String(DEFAULT_CUT_EFFECT_DURATION_MS));
    expect((endDurationInput as HTMLInputElement).value).toBe(String(DEFAULT_CUT_EFFECT_DURATION_MS));

    fireEvent.change(startEffectSelect, { target: { value: 'fade' } });
    fireEvent.change(startDurationInput, { target: { value: '450' } });
    fireEvent.change(endEffectSelect, { target: { value: 'zoom-out' } });
    fireEvent.change(endDurationInput, { target: { value: '900' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onQueuePatch).toHaveBeenCalledWith('cut-1', {
      startEffect: 'fade',
      endEffect: 'zoom-out',
      startEffectDurationMs: 450,
      endEffectDurationMs: 900
    });

    vi.useRealTimers();
  });
});
