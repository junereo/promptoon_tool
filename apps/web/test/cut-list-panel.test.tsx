import type { Choice, Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CutListPanel } from '../src/widgets/cut-list-panel/CutListPanel';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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

function buildChoice(id: string, cutId: string, overrides?: Partial<Choice>): Choice {
  return {
    id,
    cutId,
    label: `Choice ${id}`,
    orderIndex: 0,
    nextCutId: null,
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
        choices={[]}
        cuts={cuts}
        onCreateCut={onCreateCut}
        onDeleteCut={onDeleteCut}
        onDragEnd={onDragEnd}
        onSelectCut={onSelectCut}
        selectedCutId="cut-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Cut' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add cut after Branch' }));
    fireEvent.click(screen.getByText('Branch'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Branch' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('삭제 하시겠습니까.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.getByText('choice')).toBeTruthy();
    expect(onCreateCut).toHaveBeenCalledTimes(2);
    expect(onCreateCut).toHaveBeenNthCalledWith(1);
    expect(onCreateCut).toHaveBeenNthCalledWith(2, 'cut-2');
    expect(onSelectCut).toHaveBeenCalledWith('cut-2');
    await waitFor(() => {
      expect(onDeleteCut).toHaveBeenCalledWith('cut-2', { reconnectToCutId: null });
    });
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('does not delete when the confirm modal is cancelled', () => {
    const onDeleteCut = vi.fn();

    render(
      <CutListPanel
        choices={[]}
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
        choices={[]}
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
        choices={[]}
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

  it('renders compressed ranks with slight indentation and collapses branch groups', () => {
    const start = buildCut('cut-start', { title: 'Start', isStart: true });
    const child = buildCut('cut-child', { title: 'Child' });
    const grandchild = buildCut('cut-grandchild', { title: 'Grandchild' });
    const choices = [
      buildChoice('choice-child', start.id, { nextCutId: child.id }),
      buildChoice('choice-grandchild', child.id, { nextCutId: grandchild.id })
    ];

    render(
      <CutListPanel
        choices={choices}
        cuts={[start, child, grandchild]}
        onCreateCut={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId={null}
      />
    );

    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('1.1')).toBeNull();
    expect(screen.queryByText('1.1.1')).toBeNull();
    expect((document.querySelector('[data-cut-id="cut-grandchild"]') as HTMLElement | null)?.style.marginLeft).toBe('6px');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse group 1' }));

    expect(screen.queryByText('Start')).toBeNull();
    expect(screen.queryByText('Child')).toBeNull();
    expect(screen.queryByText('Grandchild')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand group 1' }));

    expect(screen.getByText('Child')).toBeTruthy();
  });

  it('keeps manually inserted unlinked cuts between linked cuts in display order', () => {
    const start = buildCut('cut-start', { title: 'Start', isStart: true, orderIndex: 0 });
    const inserted = buildCut('cut-inserted', { title: 'Inserted', orderIndex: 1 });
    const child = buildCut('cut-child', { title: 'Child', orderIndex: 2 });
    const choices = [buildChoice('choice-child', start.id, { nextCutId: child.id })];

    render(
      <CutListPanel
        choices={choices}
        cuts={[start, inserted, child]}
        onCreateCut={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId={null}
      />
    );

    expect(
      Array.from(document.querySelectorAll<HTMLElement>('[data-cut-id]')).map((element) => element.dataset.cutId)
    ).toEqual(['cut-start', 'cut-inserted', 'cut-child']);
  });

  it('compresses long single-choice chains to branch points', () => {
    const start = buildCut('cut-start', { title: 'Start', isStart: true });
    const mainA = buildCut('cut-main-a', { title: 'Main A' });
    const mainB = buildCut('cut-main-b', { title: 'Main B' });
    const mainC = buildCut('cut-main-c', { title: 'Main C' });
    const branchA = buildCut('cut-branch-a', { title: 'Branch A' });
    const branchB = buildCut('cut-branch-b', { title: 'Branch B' });
    const choices = [
      buildChoice('choice-main-a', start.id, { nextCutId: mainA.id, orderIndex: 0 }),
      buildChoice('choice-main-b', mainA.id, { nextCutId: mainB.id, orderIndex: 0 }),
      buildChoice('choice-main-c', mainB.id, { nextCutId: mainC.id, orderIndex: 0 }),
      buildChoice('choice-branch-a', mainB.id, { nextCutId: branchA.id, orderIndex: 1 }),
      buildChoice('choice-branch-b', branchA.id, { nextCutId: branchB.id, orderIndex: 0 })
    ];
    const onSelectCut = vi.fn();

    render(
      <CutListPanel
        choices={choices}
        cuts={[start, mainA, mainB, mainC, branchA, branchB]}
        onCreateCut={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onSelectCut={onSelectCut}
        selectedCutId={null}
      />
    );

    expect(screen.getByRole('button', { name: 'Collapse group 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse group 1.2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Collapse group 1.1.1.2' })).toBeNull();
    expect(screen.getAllByText('Main B')).toHaveLength(2);

    fireEvent.click(screen.getAllByText('Main B')[1]);

    expect(onSelectCut).toHaveBeenCalledWith('cut-main-b');
  });

  it('adds a second-level fold for choice-based flow sections inside a branch', () => {
    const intro = buildCut('cut-intro', { title: 'Intro', isStart: true });
    const decision = buildCut('cut-decision', { kind: 'choice', title: 'Decision' });
    const aftermath = buildCut('cut-aftermath', { title: 'Aftermath' });
    const choices = [
      buildChoice('choice-decision', intro.id, { nextCutId: decision.id }),
      buildChoice('choice-aftermath', decision.id, { nextCutId: aftermath.id })
    ];

    render(
      <CutListPanel
        choices={choices}
        cuts={[intro, decision, aftermath]}
        onCreateCut={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse flow 1 Decision' }));

    expect(screen.getByText('Intro')).toBeTruthy();
    expect(screen.queryByText('Decision')).toBeNull();
    expect(screen.queryByText('Aftermath')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand flow 1 Decision' }));

    expect(screen.getByText('Aftermath')).toBeTruthy();
  });

  it('persists branch group fold state in localStorage', () => {
    const start = buildCut('cut-start', { title: 'Start', isStart: true });
    const child = buildCut('cut-child', { title: 'Child' });
    const choices = [buildChoice('choice-child', start.id, { nextCutId: child.id })];
    const props = {
      choices,
      cuts: [start, child],
      onCreateCut: vi.fn(),
      onDeleteCut: vi.fn(),
      onDragEnd: vi.fn(),
      onSelectCut: vi.fn(),
      selectedCutId: null
    };

    const { unmount } = render(<CutListPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse group 1' }));
    expect(screen.queryByText('Start')).toBeNull();

    unmount();
    render(<CutListPanel {...props} />);

    expect(screen.getByRole('button', { name: 'Expand group 1' })).toBeTruthy();
    expect(screen.queryByText('Child')).toBeNull();
  });

  it('persists second-level flow fold state in localStorage', () => {
    const intro = buildCut('cut-intro', { title: 'Intro', isStart: true });
    const decision = buildCut('cut-decision', { kind: 'choice', title: 'Decision' });
    const aftermath = buildCut('cut-aftermath', { title: 'Aftermath' });
    const choices = [
      buildChoice('choice-decision', intro.id, { nextCutId: decision.id }),
      buildChoice('choice-aftermath', decision.id, { nextCutId: aftermath.id })
    ];
    const props = {
      choices,
      cuts: [intro, decision, aftermath],
      onCreateCut: vi.fn(),
      onDeleteCut: vi.fn(),
      onDragEnd: vi.fn(),
      onSelectCut: vi.fn(),
      selectedCutId: null
    };

    const { unmount } = render(<CutListPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse flow 1 Decision' }));
    expect(screen.queryByText('Aftermath')).toBeNull();

    unmount();
    render(<CutListPanel {...props} />);

    expect(screen.getByRole('button', { name: 'Expand flow 1 Decision' })).toBeTruthy();
    expect(screen.getByText('Intro')).toBeTruthy();
    expect(screen.queryByText('Aftermath')).toBeNull();
  });

  it('offers reconnect targets when deleting a cut with incoming choices', async () => {
    const start = buildCut('cut-start', { title: 'Start', isStart: true });
    const middle = buildCut('cut-middle', { title: 'Middle' });
    const ending = buildCut('cut-ending', { title: 'Ending' });
    const choices = [
      buildChoice('choice-incoming', start.id, { nextCutId: middle.id }),
      buildChoice('choice-outgoing', middle.id, { nextCutId: ending.id })
    ];
    const onDeleteCut = vi.fn();

    render(
      <CutListPanel
        choices={choices}
        cuts={[start, middle, ending]}
        onCreateCut={vi.fn()}
        onDeleteCut={onDeleteCut}
        onDragEnd={vi.fn()}
        onSelectCut={vi.fn()}
        selectedCutId={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Middle' }));
    expect(screen.getByLabelText('Reconnect incoming choices')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => {
      expect(onDeleteCut).toHaveBeenCalledWith('cut-middle', { reconnectToCutId: 'cut-ending' });
    });
  });
});
