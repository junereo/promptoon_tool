import type { Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CutListPanel } from '../src/widgets/cut-list-panel/CutListPanel';

afterEach(() => {
  cleanup();
});

function buildCut(id: string, overrides?: Partial<Cut>): Cut {
  return {
    id,
    episodeId: 'episode-1',
    kind: 'scene',
    title: `Cut ${id}`,
    body: 'Preview body',
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

describe('CutListPanel', () => {
  it('renders cuts and routes create/select/delete actions through a confirm modal', async () => {
    const onCreateCut = vi.fn();
    const onDeleteCut = vi.fn();
    const onDragEnd = vi.fn();
    const onSelectCut = vi.fn();
    const cuts = [buildCut('cut-1'), buildCut('cut-2', { kind: 'choice', title: 'Branch' })];

    render(
      <CutListPanel
        cuts={cuts}
        onCreateCut={onCreateCut}
        onDeleteCut={onDeleteCut}
        onDragEnd={onDragEnd}
        onSelectCut={onSelectCut}
        selectedCutId="cut-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Cut' }));
    fireEvent.click(screen.getByText('Branch'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Branch' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('삭제 하시겠습니까.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.getByText('choice')).toBeTruthy();
    expect(onCreateCut).toHaveBeenCalledTimes(1);
    expect(onSelectCut).toHaveBeenCalledWith('cut-2');
    await waitFor(() => {
      expect(onDeleteCut).toHaveBeenCalledWith('cut-2');
    });
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('does not delete when the confirm modal is cancelled', () => {
    const onDeleteCut = vi.fn();

    render(
      <CutListPanel
        cuts={[buildCut('cut-1', { title: 'Intro' })]}
        onCreateCut={vi.fn()}
        onDeleteCut={onDeleteCut}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId="cut-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Intro' }));
    fireEvent.click(screen.getAllByRole('button', { name: '취소' })[0]);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDeleteCut).not.toHaveBeenCalled();
  });

  it('does not auto-scroll when selection changes', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    });

    const cuts = [buildCut('cut-1'), buildCut('cut-2', { title: 'Newest cut' })];
    const { rerender } = render(
      <CutListPanel
        cuts={cuts}
        onCreateCut={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId={null}
      />
    );

    rerender(
      <CutListPanel
        cuts={cuts}
        onCreateCut={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId="cut-2"
      />
    );

    expect(scrollIntoView).not.toHaveBeenCalled();

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: original
    });
  });
});
