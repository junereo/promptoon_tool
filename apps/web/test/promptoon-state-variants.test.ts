import { describe, expect, it } from 'vitest';

import { resolveStateRouterTargetCut } from '../src/shared/lib/promptoon-state-variants';

type TestCut = {
  id: string;
  kind: string;
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
});
