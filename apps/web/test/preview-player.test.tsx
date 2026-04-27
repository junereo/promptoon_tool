import type { Choice, Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewPlayer } from '../src/widgets/preview-phone-frame/PreviewPlayer';

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

describe('PreviewPlayer', () => {
  it('renders an empty state when no cut is available', () => {
    render(
      <PreviewPlayer
        choices={[]}
        cut={null}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        selectedChoiceId={null}
      />
    );

    expect(screen.getByText('표시할 컷이 없습니다.')).toBeTruthy();
  });

  it('routes linked and unlinked choice clicks correctly even for scene cuts', () => {
    vi.useFakeTimers();
    const onSelectChoice = vi.fn();
    const onSelectCut = vi.fn();
    const cut = buildCut('cut-1', {
      kind: 'scene',
      title: 'Branching',
      body: 'Pick a path.',
      endEffect: 'fade',
      endEffectDurationMs: 0
    });
    const linkedChoice = buildChoice('choice-1', cut.id, { label: 'Go next', nextCutId: 'cut-2' });
    const unlinkedChoice = buildChoice('choice-2', cut.id, { label: 'Need wiring' });

    render(
      <PreviewPlayer
        choices={[linkedChoice, unlinkedChoice]}
        cut={cut}
        onSelectChoice={onSelectChoice}
        onSelectCut={onSelectCut}
        selectedChoiceId="choice-2"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Need wiring WARN' }));

    act(() => {
      vi.runAllTimers();
    });

    expect(onSelectCut).toHaveBeenCalledWith('cut-2');
    expect(onSelectChoice).not.toHaveBeenCalled();
    expect(screen.getByText('WARN')).toBeTruthy();

    vi.useRealTimers();
  });

  it('does not auto-advance when the cut has a single linked choice', () => {
    vi.useFakeTimers();
    const onSelectCut = vi.fn();
    const cut = buildCut('cut-1', { kind: 'scene', title: 'Single path' });
    const linkedChoice = buildChoice('choice-1', cut.id, { label: 'Continue', nextCutId: 'cut-2' });

    render(
      <PreviewPlayer
        choices={[linkedChoice]}
        cut={cut}
        onSelectChoice={vi.fn()}
        onSelectCut={onSelectCut}
        selectedChoiceId={null}
      />
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(onSelectCut).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('fades in loaded images and falls back on error', () => {
    const cut = buildCut('cut-1', { assetUrl: 'https://example.com/image.png' });
    const { rerender } = render(
      <PreviewPlayer
        choices={[]}
        cut={cut}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        selectedChoiceId={null}
      />
    );

    const image = screen.getByRole('img', { name: cut.title });
    expect(image.className.includes('opacity-0')).toBe(true);

    fireEvent.load(image);
    expect(image.className.includes('opacity-100')).toBe(true);

    rerender(
      <PreviewPlayer
        choices={[]}
        cut={buildCut('cut-1', { assetUrl: 'https://example.com/broken.png' })}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        selectedChoiceId={null}
      />
    );

    const brokenImage = screen.getByRole('img', { name: /cut cut-1/i });
    fireEvent.error(brokenImage);
    expect(screen.queryByRole('img', { name: /cut cut-1/i })).toBeNull();
  });

  it('renders ending state UI', () => {
    render(
      <PreviewPlayer
        choices={[]}
        cut={buildCut('cut-end', { kind: 'ending', title: 'Finale' })}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        selectedChoiceId={null}
      />
    );

    expect(screen.getByRole('button', { name: '엔딩 도달' })).toBeTruthy();
  });

  it('exposes the applied start and end effects on the preview motion wrapper', () => {
    render(
      <PreviewPlayer
        choices={[]}
        cut={buildCut('cut-animated', {
          startEffect: 'fade',
          endEffect: 'slide-left',
          startEffectDurationMs: 1000,
          endEffectDurationMs: 450
        })}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        selectedChoiceId={null}
      />
    );

    const motionWrapper = screen.getByTestId('preview-cut-motion');
    expect(motionWrapper.getAttribute('data-start-effect')).toBe('fade');
    expect(motionWrapper.getAttribute('data-end-effect')).toBe('slide-left');
    expect(motionWrapper.getAttribute('data-start-effect-duration-ms')).toBe('1000');
    expect(motionWrapper.getAttribute('data-end-effect-duration-ms')).toBe('450');
  });

  it('renders inverse content view mode with dark text styling', () => {
    render(
      <PreviewPlayer
        choices={[]}
        cut={buildCut('cut-inverse', { body: 'Inverse body', contentViewMode: 'inverse' })}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        selectedChoiceId={null}
      />
    );

    expect(screen.getByText('Inverse body').className.includes('text-zinc-900/88')).toBe(true);
  });
});
