import type { EpisodeDraftResponse } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import { validateEpisodeGraph } from '../src/modules/promptoon-authoring/promptoon.validators';

function buildDraft(overrides?: Partial<EpisodeDraftResponse>): EpisodeDraftResponse {
  return {
    episode: {
      id: '11111111-1111-1111-1111-111111111111',
      projectId: '22222222-2222-2222-2222-222222222222',
      title: 'Episode 1',
      episodeNo: 1,
      startCutId: '33333333-3333-3333-3333-333333333333',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    cuts: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        episodeId: '11111111-1111-1111-1111-111111111111',
        kind: 'scene',
        title: 'Start',
        body: '',
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
        id: '44444444-4444-4444-4444-444444444444',
        episodeId: '11111111-1111-1111-1111-111111111111',
        kind: 'ending',
        title: 'Ending',
        body: '',
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
        id: '55555555-5555-5555-5555-555555555555',
        cutId: '33333333-3333-3333-3333-333333333333',
        label: 'Go',
        orderIndex: 0,
        nextCutId: '44444444-4444-4444-4444-444444444444',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    ...overrides
  };
}

describe('validateEpisodeGraph', () => {
  it('accepts a valid simple graph', () => {
    const result = validateEpisodeGraph(buildDraft());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects multiple start cuts', () => {
    const draft = buildDraft({
      cuts: [
        ...buildDraft().cuts,
        {
          ...buildDraft().cuts[1],
          id: '66666666-6666-6666-6666-666666666666',
          kind: 'scene',
          isStart: true,
          isEnding: false
        }
      ]
    });

    const result = validateEpisodeGraph(draft);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'multiple_start_cuts')).toBe(true);
  });

  it('rejects unreachable cuts', () => {
    const draft = buildDraft({
      cuts: [
        ...buildDraft().cuts,
        {
          ...buildDraft().cuts[1],
          id: '77777777-7777-7777-7777-777777777777',
          title: 'Unreachable'
        }
      ]
    });

    const result = validateEpisodeGraph(draft);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'unreachable_cut')).toBe(true);
  });

  it('rejects dead paths that cannot reach an ending', () => {
    const draft = buildDraft({
      cuts: [
        buildDraft().cuts[0],
        {
          ...buildDraft().cuts[1],
          id: '88888888-8888-8888-8888-888888888888',
          kind: 'scene',
          title: 'Loop',
          isEnding: false
        },
        buildDraft().cuts[1]
      ],
      choices: [
        {
          ...buildDraft().choices[0],
          nextCutId: '88888888-8888-8888-8888-888888888888'
        },
        {
          id: '99999999-9999-9999-9999-999999999999',
          cutId: '88888888-8888-8888-8888-888888888888',
          label: 'Again',
          orderIndex: 0,
          nextCutId: '88888888-8888-8888-8888-888888888888',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    });

    const result = validateEpisodeGraph(draft);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'dead_path')).toBe(true);
  });
});
