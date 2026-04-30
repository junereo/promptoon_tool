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
      coverImageUrl: '/uploads/cover.jpg',
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

function buildExitLoopDraft(): EpisodeDraftResponse {
  const baseDraft = buildDraft();
  const [baseStartCut, baseEndingCut] = baseDraft.cuts;
  const loopStage1 = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000001',
    kind: 'loopStage' as const,
    title: 'Loop Stage 1',
    isStart: true,
    loopMetadata: {
      kind: 'exitLoop' as const,
      groupId: 'test-loop',
      groupLabel: 'Test Loop',
      role: 'stageBase' as const,
      stageIndex: 1,
      stageCount: 2,
      selectedVariantCutId: '10000000-0000-4000-8000-000000000002',
      variantCutIds: ['10000000-0000-4000-8000-000000000002'],
      resetStateOnEnter: true,
      resetStateKeyPrefix: 'exitLoop.test-loop.',
      exitLevelRequired: 5
    }
  };
  const loopVariant1 = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000002',
    kind: 'loopVariant' as const,
    title: 'Loop Stage 1 Variant',
    isStart: false,
    loopMetadata: {
      kind: 'exitLoop' as const,
      groupId: 'test-loop',
      groupLabel: 'Test Loop',
      role: 'stageVariant' as const,
      stageIndex: 1,
      stageCount: 2,
      truth: 'real_anomaly' as const,
      expectedChoice: 'back' as const,
      baseCutId: loopStage1.id
    }
  };
  const loopSpacer = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000003',
    kind: 'loopSpacer' as const,
    title: 'Loop Spacer',
    isStart: false,
    loopMetadata: {
      kind: 'exitLoop' as const,
      groupId: 'test-loop',
      groupLabel: 'Test Loop',
      role: 'spacer' as const,
      stageIndex: 1,
      stageCount: 2
    }
  };
  const loopStage2 = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000004',
    kind: 'loopStage' as const,
    title: 'Loop Stage 2',
    isStart: false,
    loopMetadata: {
      kind: 'exitLoop' as const,
      groupId: 'test-loop',
      groupLabel: 'Test Loop',
      role: 'stageBase' as const,
      stageIndex: 2,
      stageCount: 2,
      selectedVariantCutId: '10000000-0000-4000-8000-000000000005',
      variantCutIds: ['10000000-0000-4000-8000-000000000005'],
      exitLevelRequired: 5
    }
  };
  const loopVariant2 = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000005',
    kind: 'loopVariant' as const,
    title: 'Loop Stage 2 Variant',
    isStart: false,
    loopMetadata: {
      kind: 'exitLoop' as const,
      groupId: 'test-loop',
      groupLabel: 'Test Loop',
      role: 'stageVariant' as const,
      stageIndex: 2,
      stageCount: 2,
      truth: 'fake_suspicion' as const,
      expectedChoice: 'forward' as const,
      baseCutId: loopStage2.id
    }
  };
  const resultRouter = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000006',
    kind: 'stateRouter' as const,
    title: 'Loop Result Router',
    isStart: false,
    stateRoutes: [
      {
        id: 'loop-result-exit',
        conditions: [
          {
            stateKey: 'exitLoop.test-loop.route',
            equals: 'exit'
          }
        ],
        nextCutId: '10000000-0000-4000-8000-000000000007'
      }
    ],
    stateFallbackCutId: loopStage1.id,
    loopMetadata: {
      kind: 'exitLoop' as const,
      groupId: 'test-loop',
      groupLabel: 'Test Loop',
      role: 'resultRouter' as const,
      stageCount: 2,
      exitLevelRequired: 5
    }
  };
  const continuationCut = {
    ...baseStartCut,
    id: '10000000-0000-4000-8000-000000000007',
    kind: 'scene' as const,
    title: 'Loop Continuation',
    isStart: false
  };
  const endingCut = {
    ...baseEndingCut,
    id: '10000000-0000-4000-8000-000000000008',
    title: 'Loop Ending'
  };

  return {
    ...baseDraft,
    episode: {
      ...baseDraft.episode,
      startCutId: loopStage1.id
    },
    cuts: [loopStage1, loopVariant1, loopSpacer, loopStage2, loopVariant2, resultRouter, continuationCut, endingCut],
    choices: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        cutId: loopStage1.id,
        label: '계속',
        orderIndex: 0,
        nextCutId: loopSpacer.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        cutId: loopSpacer.id,
        label: '계속',
        orderIndex: 0,
        nextCutId: loopStage2.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '20000000-0000-4000-8000-000000000003',
        cutId: loopStage2.id,
        label: '나아간다',
        orderIndex: 0,
        nextCutId: resultRouter.id,
        stateWrites: [
          {
            key: 'exitLoop.test-loop.decision',
            operation: 'exitLoopDecision',
            value: 'forward'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '20000000-0000-4000-8000-000000000004',
        cutId: loopStage2.id,
        label: '돌아간다',
        orderIndex: 1,
        nextCutId: resultRouter.id,
        stateWrites: [
          {
            key: 'exitLoop.test-loop.decision',
            operation: 'exitLoopDecision',
            value: 'back'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '20000000-0000-4000-8000-000000000005',
        cutId: continuationCut.id,
        label: '계속',
        orderIndex: 0,
        nextCutId: endingCut.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  };
}

describe('validateEpisodeGraph', () => {
  it('accepts a valid simple graph', () => {
    const result = validateEpisodeGraph(buildDraft());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('treats resultCard cuts as endings even without isEnding set', () => {
    const baseDraft = buildDraft();
    const resultCardCut = {
      ...baseDraft.cuts[1],
      kind: 'resultCard' as const,
      title: 'Result Card',
      isEnding: false,
      contentBlocks: [
        {
          id: 'result-card-1',
          type: 'resultCard' as const,
          templateId: 'the-replace-final' as const,
          theme: 'blue' as const,
          badge: 'TYPE 01',
          resultName: '합리적인 가해자',
          tagline: '알면서도 손을 들었다',
          lines: ['당신은 명확히 보았다.'],
          inflowLabel: 'CHECK IN',
          inflowUrl: 'promtoon.ai',
          inflowBrand: 'PROMTOON',
          inflowTagline: '반응형 웹툰'
        }
      ]
    };

    const result = validateEpisodeGraph(
      buildDraft({
        cuts: [baseDraft.cuts[0], resultCardCut],
        choices: [
          {
            ...baseDraft.choices[0],
            nextCutId: resultCardCut.id
          }
        ]
      })
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when the episode cover image is missing without blocking validation', () => {
    const result = validateEpisodeGraph(
      buildDraft({
        episode: {
          ...buildDraft().episode,
          coverImageUrl: null
        }
      })
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings.some((issue) => issue.code === 'missing_episode_cover')).toBe(true);
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

  it('allows render-only state variant cuts referenced from a reachable cut', () => {
    const draft = buildDraft({
      cuts: [
        {
          ...buildDraft().cuts[0],
          stateVariants: [
            {
              id: 'variant-1',
              stateKey: 'first_route',
              equals: 'A',
              variantCutId: '77777777-7777-7777-7777-777777777777'
            }
          ]
        },
        buildDraft().cuts[1],
        {
          ...buildDraft().cuts[1],
          id: '77777777-7777-7777-7777-777777777777',
          kind: 'scene',
          title: 'A Route Variant',
          isEnding: false
        }
      ]
    });

    const result = validateEpisodeGraph(draft);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing state variant targets', () => {
    const draft = buildDraft({
      cuts: [
        {
          ...buildDraft().cuts[0],
          stateVariants: [
            {
              id: 'variant-1',
              stateKey: 'first_route',
              equals: 'A',
              variantCutId: '77777777-7777-7777-7777-777777777777'
            }
          ]
        },
        buildDraft().cuts[1]
      ]
    });

    const result = validateEpisodeGraph(draft);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'invalid_state_variant_target')).toBe(true);
  });

  it('treats state router routes and fallback as real graph edges', () => {
    const baseDraft = buildDraft();
    const routerCut = {
      ...baseDraft.cuts[0],
      id: '66666666-6666-6666-6666-666666666666',
      kind: 'stateRouter' as const,
      title: 'State Router',
      isStart: false,
      stateRoutes: [
        {
          id: 'route-a',
          stateKey: 'first_route',
          equals: 'A',
          nextCutId: '77777777-7777-7777-7777-777777777777'
        }
      ],
      stateFallbackCutId: '88888888-8888-8888-8888-888888888888'
    };
    const routeACut = {
      ...baseDraft.cuts[1],
      id: '77777777-7777-7777-7777-777777777777',
      kind: 'scene' as const,
      title: 'A Route',
      isEnding: false
    };
    const fallbackCut = {
      ...baseDraft.cuts[1],
      id: '88888888-8888-8888-8888-888888888888',
      kind: 'scene' as const,
      title: 'Fallback',
      isEnding: false
    };

    const result = validateEpisodeGraph(
      buildDraft({
        cuts: [baseDraft.cuts[0], routerCut, routeACut, fallbackCut, baseDraft.cuts[1]],
        choices: [
          {
            ...baseDraft.choices[0],
            nextCutId: routerCut.id
          },
          {
            id: '99999999-9999-9999-9999-999999999991',
            cutId: routeACut.id,
            label: 'End',
            orderIndex: 0,
            nextCutId: baseDraft.cuts[1].id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: '99999999-9999-9999-9999-999999999992',
            cutId: fallbackCut.id,
            label: 'End',
            orderIndex: 0,
            nextCutId: baseDraft.cuts[1].id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      })
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects state router cuts without fallback or routes', () => {
    const baseDraft = buildDraft();
    const routerCut = {
      ...baseDraft.cuts[0],
      id: '66666666-6666-6666-6666-666666666666',
      kind: 'stateRouter' as const,
      title: 'State Router',
      isStart: false,
      stateRoutes: []
    };

    const result = validateEpisodeGraph(
      buildDraft({
        cuts: [baseDraft.cuts[0], routerCut, baseDraft.cuts[1]],
        choices: [
          {
            ...baseDraft.choices[0],
            nextCutId: routerCut.id
          }
        ]
      })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'missing_state_router_route')).toBe(true);
    expect(result.errors.some((issue) => issue.code === 'missing_state_router_fallback')).toBe(true);
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

  it('accepts a valid Exit Loop cut graph and treats loop variants as referenced render cuts', () => {
    const result = validateEpisodeGraph(buildExitLoopDraft());

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects Exit Loop groups missing the first-stage state prefix metadata', () => {
    const draft = buildExitLoopDraft();
    const result = validateEpisodeGraph({
      ...draft,
      cuts: draft.cuts.map((cut) =>
        cut.id === '10000000-0000-4000-8000-000000000001'
          ? {
              ...cut,
              loopMetadata: cut.loopMetadata
                ? {
                    ...cut.loopMetadata,
                    resetStateKeyPrefix: undefined
                  }
                : cut.loopMetadata
            }
          : cut
      )
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'missing_loop_entry_reset')).toBe(true);
  });

  it('rejects Exit Loop decision choices without managed decision writes', () => {
    const draft = buildExitLoopDraft();
    const result = validateEpisodeGraph({
      ...draft,
      choices: draft.choices.map((choice) =>
        choice.id === '20000000-0000-4000-8000-000000000003'
          ? { ...choice, stateWrites: [] }
          : choice.id === '20000000-0000-4000-8000-000000000004'
            ? {
                ...choice,
                stateWrites: [
                  {
                    key: 'exitLoop.test-loop.decision',
                    value: 'back'
                  }
                ]
              }
            : choice
      )
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'invalid_loop_state_mapping')).toBe(true);
  });

  it('rejects Exit Loop stages with missing selected variant cuts', () => {
    const draft = buildExitLoopDraft();
    const result = validateEpisodeGraph({
      ...draft,
      cuts: draft.cuts.filter((cut) => cut.id !== '10000000-0000-4000-8000-000000000002')
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'invalid_loop_variant_target')).toBe(true);
  });
});
