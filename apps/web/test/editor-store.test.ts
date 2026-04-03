import type { Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import { useEditorStore } from '../src/features/editor/store/use-editor-store';

function createCut(id: string, orderIndex: number, overrides?: Partial<Cut>): Cut {
  return {
    id,
    episodeId: 'episode-1',
    kind: 'scene',
    title: id.toUpperCase(),
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
    positionX: orderIndex * 200,
    positionY: 100,
    orderIndex,
    isStart: false,
    isEnding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('editor store', () => {
  it('hydrates local order from draft cuts and preserves reorder actions', () => {
    useEditorStore.getState().resetForEpisode();

    useEditorStore.getState().hydrateFromDraft({
      cuts: [createCut('cut-a', 0, { title: 'A', isStart: true }), createCut('cut-b', 1, { title: 'B' })]
    });

    useEditorStore.getState().reorderLocalCuts('cut-b', 'cut-a');

    expect(useEditorStore.getState().localCutOrder).toEqual(['cut-b', 'cut-a']);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('removes deleted cut ids from local order even while reorder is dirty', () => {
    useEditorStore.getState().resetForEpisode();

    useEditorStore.getState().hydrateFromDraft({
      cuts: [createCut('cut-a', 0, { title: 'A', isStart: true }), createCut('cut-b', 1, { title: 'B' })]
    });

    useEditorStore.getState().reorderLocalCuts('cut-b', 'cut-a');

    useEditorStore.getState().hydrateFromDraft({
      cuts: [createCut('cut-b', 0, { title: 'B', isStart: true })]
    });

    expect(useEditorStore.getState().localCutOrder).toEqual(['cut-b']);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('resyncs to server order when reorder is not dirty', () => {
    useEditorStore.getState().resetForEpisode();

    useEditorStore.getState().hydrateFromDraft({
      cuts: [createCut('cut-a', 0, { title: 'A', isStart: true }), createCut('cut-b', 1, { title: 'B' })]
    });

    useEditorStore.getState().hydrateFromDraft({
      cuts: [createCut('cut-b', 0, { title: 'B', isStart: true }), createCut('cut-a', 1, { title: 'A' })]
    });

    expect(useEditorStore.getState().localCutOrder).toEqual(['cut-b', 'cut-a']);
    expect(useEditorStore.getState().isDirty).toBe(false);
  });
});
