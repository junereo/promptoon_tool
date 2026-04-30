import { describe, expect, it } from 'vitest';

import {
  applyChoiceStateWrites,
  clearPromptoonViewerStateByPrefix,
  initializeExitLoopStateForCut,
  resolveLoopRenderableCut,
  resolveStateRouterTargetCut
} from '../src/shared/lib/promptoon-state-variants';

type TestCut = {
  id: string;
  kind: string;
  assetUrl?: string | null;
  orderIndex?: number;
  loopMetadata?: {
    kind: 'exitLoop';
    groupId: string;
    role: 'stageBase' | 'stageVariant' | 'spacer' | 'resultRouter';
    baseCutId?: string | null;
    exitLevelRequired?: number;
    selectedVariantCutId?: string | null;
    stageIndex?: number;
    truth?: 'real_anomaly' | 'fake_suspicion';
    variantCutIds?: string[];
  } | null;
  stateRoutes?: Array<{
    id: string;
    stateKey?: string;
    equals?: string;
    conditions?: Array<{
      stateKey: string;
      equals: string;
    }>;
    nextCutId: string;
  }>;
  stateFallbackCutId?: string | null;
};

function cut(id: string, overrides?: Partial<TestCut>): TestCut {
  return {
    id,
    kind: 'scene',
    ...overrides
  };
}

describe('promptoon state routing', () => {
  it('matches all conditions in a state router route', () => {
    const router = cut('router', {
      kind: 'stateRouter',
      stateRoutes: [
        {
          id: 'route-aa',
          conditions: [
            {
              stateKey: 'first_route',
              equals: 'A'
            },
            {
              stateKey: 'second_route',
              equals: 'A'
            }
          ],
          nextCutId: 'cut-aa'
        },
        {
          id: 'route-ab',
          conditions: [
            {
              stateKey: 'first_route',
              equals: 'A'
            },
            {
              stateKey: 'second_route',
              equals: 'B'
            }
          ],
          nextCutId: 'cut-ab'
        }
      ],
      stateFallbackCutId: 'fallback'
    });
    const cutsById = new Map(
      [router, cut('cut-aa'), cut('cut-ab'), cut('fallback')].map((currentCut) => [currentCut.id, currentCut])
    );

    expect(resolveStateRouterTargetCut(router, { first_route: 'A', second_route: 'A' }, cutsById).id).toBe('cut-aa');
    expect(resolveStateRouterTargetCut(router, { first_route: 'A', second_route: 'B' }, cutsById).id).toBe('cut-ab');
    expect(resolveStateRouterTargetCut(router, { first_route: 'A' }, cutsById).id).toBe('fallback');
  });

  it('keeps legacy single-condition state router routes working', () => {
    const router = cut('router', {
      kind: 'stateRouter',
      stateRoutes: [
        {
          id: 'route-a',
          stateKey: 'first_route',
          equals: 'A',
          nextCutId: 'cut-a'
        }
      ],
      stateFallbackCutId: 'fallback'
    });
    const cutsById = new Map([router, cut('cut-a'), cut('fallback')].map((currentCut) => [currentCut.id, currentCut]));

    expect(resolveStateRouterTargetCut(router, { first_route: 'A' }, cutsById).id).toBe('cut-a');
  });

  it('clears only viewer state keys under the loop reset prefix', () => {
    const state = {
      'exitLoop.station.result': 'fail',
      'exitLoop.station.stage': '2',
      'exitLoop.other.result': 'fail',
      readerName: 'Min'
    };

    expect(clearPromptoonViewerStateByPrefix(state, 'exitLoop.station.')).toEqual({
      'exitLoop.other.result': 'fail',
      readerName: 'Min'
    });
    expect(clearPromptoonViewerStateByPrefix(state, 'missing.')).toBe(state);
  });

  it('renders the selected loop variant while keeping the stage as the playable cut', () => {
    const stage = cut('stage-1', {
      kind: 'loopStage',
      assetUrl: '/base.webp',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'station',
        role: 'stageBase',
        selectedVariantCutId: 'variant-1'
      }
    });
    const variant = cut('variant-1', {
      kind: 'loopVariant',
      assetUrl: '/variant.webp',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'station',
        role: 'stageVariant'
      }
    });
    const cutsById = new Map([stage, variant].map((currentCut) => [currentCut.id, currentCut]));

    expect(resolveLoopRenderableCut(stage, cutsById)).toBe(variant);
  });

  it('renders only the active loop variant in a one-variant-per-cycle loop', () => {
    const stage1 = cut('stage-1', {
      kind: 'loopStage',
      loopMetadata: {
        kind: 'exitLoop',
        exitLevelRequired: 5,
        groupId: 'station',
        role: 'stageBase',
        stageIndex: 1,
        variantCutIds: ['variant-1']
      }
    });
    const stage2 = cut('stage-2', {
      kind: 'loopStage',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'station',
        role: 'stageBase',
        stageIndex: 2,
        variantCutIds: ['variant-2']
      }
    });
    const variant1 = cut('variant-1', {
      kind: 'loopVariant',
      orderIndex: 1,
      loopMetadata: {
        baseCutId: stage1.id,
        kind: 'exitLoop',
        groupId: 'station',
        role: 'stageVariant',
        stageIndex: 1,
        truth: 'real_anomaly'
      }
    });
    const variant2 = cut('variant-2', {
      kind: 'loopVariant',
      orderIndex: 2,
      loopMetadata: {
        baseCutId: stage2.id,
        kind: 'exitLoop',
        groupId: 'station',
        role: 'stageVariant',
        stageIndex: 2,
        truth: 'fake_suspicion'
      }
    });
    const cutsById = new Map([stage1, stage2, variant1, variant2].map((currentCut) => [currentCut.id, currentCut]));
    const initializedState = initializeExitLoopStateForCut({}, stage1, cutsById);

    expect(initializedState['exitLoop.station.activeVariantCutId']).toBe('variant-1');
    expect(resolveLoopRenderableCut(stage1, cutsById, initializedState)).toBe(variant1);
    expect(resolveLoopRenderableCut(stage2, cutsById, initializedState)).toBe(stage2);
  });

  it('updates loop level and route from the final decision choice', () => {
    const retryState = applyChoiceStateWrites(
      {
        'exitLoop.station.activeTruth': 'real_anomaly',
        'exitLoop.station.exitLevelRequired': '5',
        'exitLoop.station.level': '4'
      },
      {
        stateWrites: [
          {
            key: 'exitLoop.station.decision',
            operation: 'exitLoopDecision',
            value: 'back'
          }
        ]
      }
    );

    expect(retryState['exitLoop.station.level']).toBe('5');
    expect(retryState['exitLoop.station.route']).toBe('retry');

    const exitState = applyChoiceStateWrites(
      {
        'exitLoop.station.activeTruth': 'fake_suspicion',
        'exitLoop.station.exitLevelRequired': '5',
        'exitLoop.station.level': '4'
      },
      {
        stateWrites: [
          {
            key: 'exitLoop.station.decision',
            operation: 'exitLoopDecision',
            value: 'forward'
          }
        ]
      }
    );

    expect(exitState['exitLoop.station.level']).toBe('5');
    expect(exitState['exitLoop.station.route']).toBe('exit');

    const resetState = applyChoiceStateWrites(
      {
        'exitLoop.station.activeTruth': 'real_anomaly',
        'exitLoop.station.exitLevelRequired': '5',
        'exitLoop.station.level': '4'
      },
      {
        stateWrites: [
          {
            key: 'exitLoop.station.decision',
            operation: 'exitLoopDecision',
            value: 'forward'
          }
        ]
      }
    );

    expect(resetState['exitLoop.station.level']).toBe('0');
    expect(resetState['exitLoop.station.route']).toBe('retry');
  });
});
