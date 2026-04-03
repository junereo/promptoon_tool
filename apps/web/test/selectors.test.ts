import type { Choice, Cut, EditorSelection } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import { getPreviewCut, sortCutsByLocalOrder } from '../src/entities/promptoon/selectors';

function createCut(id: string, orderIndex: number, options?: Partial<Cut>): Cut {
  return {
    id,
    episodeId: 'episode-1',
    kind: 'scene',
    title: id,
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
    positionX: 0,
    positionY: 100,
    orderIndex,
    isStart: false,
    isEnding: false,
    createdAt: new Date(orderIndex + 1).toISOString(),
    updatedAt: new Date(orderIndex + 1).toISOString(),
    ...options
  };
}

describe('promptoon selectors', () => {
  it('sorts cuts by local order when provided', () => {
    const cuts = [createCut('cut-a', 0), createCut('cut-b', 1), createCut('cut-c', 2)];
    const result = sortCutsByLocalOrder(cuts, ['cut-c', 'cut-a', 'cut-b']);

    expect(result.map((cut) => cut.id)).toEqual(['cut-c', 'cut-a', 'cut-b']);
  });

  it('falls back to the start cut for preview when there is no selection', () => {
    const cuts = [createCut('cut-a', 1), createCut('cut-b', 0, { isStart: true })];
    const selection: EditorSelection = { type: 'none' };

    expect(getPreviewCut(cuts, [] satisfies Choice[], selection)?.id).toBe('cut-b');
  });
});
