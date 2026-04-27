import type { Choice, Cut, EditorSelection } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import { buildCutHierarchy, getPreviewCut, sortCutsByLocalOrder } from '../src/entities/promptoon/selectors';

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

  it('builds root ranks from the provided cut order so local drag order is preserved', () => {
    const cuts = [
      createCut('cut-a', 0, { isStart: true }),
      createCut('cut-c', 2),
      createCut('cut-b', 1)
    ];

    const hierarchy = buildCutHierarchy(cuts, []);

    expect(hierarchy.flatNodes.map((node) => [node.cut.id, node.rank])).toEqual([
      ['cut-a', '1'],
      ['cut-c', '2'],
      ['cut-b', '3']
    ]);
  });

  it('falls back to the start cut for preview when there is no selection', () => {
    const cuts = [createCut('cut-a', 1), createCut('cut-b', 0, { isStart: true })];
    const selection: EditorSelection = { type: 'none' };

    expect(getPreviewCut(cuts, [] satisfies Choice[], selection)?.id).toBe('cut-b');
  });

  it('builds nested rank labels from connected choices', () => {
    const cuts = [
      createCut('cut-start', 0, { isStart: true }),
      createCut('cut-child', 1),
      createCut('cut-grandchild', 2)
    ];
    const choices: Choice[] = [
      {
        id: 'choice-1',
        cutId: 'cut-start',
        label: 'Go',
        orderIndex: 0,
        nextCutId: 'cut-child',
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString()
      },
      {
        id: 'choice-2',
        cutId: 'cut-child',
        label: 'Deeper',
        orderIndex: 0,
        nextCutId: 'cut-grandchild',
        createdAt: new Date(2).toISOString(),
        updatedAt: new Date(2).toISOString()
      }
    ];

    const hierarchy = buildCutHierarchy(cuts, choices);

    expect(hierarchy.flatNodes.map((node) => [node.cut.id, node.rank])).toEqual([
      ['cut-start', '1'],
      ['cut-child', '1.1'],
      ['cut-grandchild', '1.1.1']
    ]);
  });

  it('orders sibling ranks by choice order and keeps duplicate incoming cuts canonical', () => {
    const cuts = [
      createCut('cut-start', 0, { isStart: true }),
      createCut('cut-a', 1),
      createCut('cut-b', 2),
      createCut('cut-c', 3),
      createCut('cut-later-parent', 4)
    ];
    const choices: Choice[] = [
      {
        id: 'choice-b',
        cutId: 'cut-start',
        label: 'B',
        orderIndex: 1,
        nextCutId: 'cut-b',
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString()
      },
      {
        id: 'choice-a',
        cutId: 'cut-start',
        label: 'A',
        orderIndex: 0,
        nextCutId: 'cut-a',
        createdAt: new Date(2).toISOString(),
        updatedAt: new Date(2).toISOString()
      },
      {
        id: 'choice-c',
        cutId: 'cut-start',
        label: 'C',
        orderIndex: 2,
        nextCutId: 'cut-c',
        createdAt: new Date(3).toISOString(),
        updatedAt: new Date(3).toISOString()
      },
      {
        id: 'choice-duplicate',
        cutId: 'cut-later-parent',
        label: 'Duplicate',
        orderIndex: 0,
        nextCutId: 'cut-a',
        createdAt: new Date(4).toISOString(),
        updatedAt: new Date(4).toISOString()
      }
    ];

    const hierarchy = buildCutHierarchy(cuts, choices);

    expect(hierarchy.flatNodes.map((node) => [node.cut.id, node.rank])).toEqual([
      ['cut-start', '1'],
      ['cut-a', '1.1'],
      ['cut-b', '1.2'],
      ['cut-c', '1.3'],
      ['cut-later-parent', '2']
    ]);
  });

  it('falls back to top-level ranks for cycles and unreachable cuts', () => {
    const cuts = [
      createCut('cut-start', 0, { isStart: true }),
      createCut('cut-cycle-a', 1),
      createCut('cut-cycle-b', 2),
      createCut('cut-unreachable', 3)
    ];
    const choices: Choice[] = [
      {
        id: 'choice-cycle-a',
        cutId: 'cut-cycle-a',
        label: 'B',
        orderIndex: 0,
        nextCutId: 'cut-cycle-b',
        createdAt: new Date(1).toISOString(),
        updatedAt: new Date(1).toISOString()
      },
      {
        id: 'choice-cycle-b',
        cutId: 'cut-cycle-b',
        label: 'A',
        orderIndex: 0,
        nextCutId: 'cut-cycle-a',
        createdAt: new Date(2).toISOString(),
        updatedAt: new Date(2).toISOString()
      }
    ];

    const hierarchy = buildCutHierarchy(cuts, choices);

    expect(hierarchy.flatNodes.map((node) => [node.cut.id, node.rank])).toEqual([
      ['cut-start', '1'],
      ['cut-cycle-a', '3'],
      ['cut-cycle-b', '3.1'],
      ['cut-unreachable', '2']
    ]);
  });
});
