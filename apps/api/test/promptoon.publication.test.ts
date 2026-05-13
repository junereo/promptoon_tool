import type { ProductPublishedChoice, ProductPublishedCut, Publish } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import { buildFeedItem } from '../src/modules/promptoon-core/publication.service';

function buildChoice(overrides: Partial<ProductPublishedChoice> = {}): ProductPublishedChoice {
  return {
    id: overrides.id ?? 'choice-1',
    label: overrides.label ?? 'Continue',
    orderIndex: overrides.orderIndex ?? 0,
    nextCutId: overrides.nextCutId ?? 'cut-ending',
    ...overrides
  };
}

function buildCut(overrides: Partial<ProductPublishedCut> = {}): ProductPublishedCut {
  return {
    id: overrides.id ?? 'cut-start',
    kind: overrides.kind ?? 'scene',
    title: overrides.title ?? 'Start',
    body: overrides.body ?? 'Start body',
    contentBlocks: overrides.contentBlocks ?? [],
    dialogAnchorX: overrides.dialogAnchorX ?? 'left',
    dialogAnchorY: overrides.dialogAnchorY ?? 'bottom',
    dialogOffsetX: overrides.dialogOffsetX ?? 0,
    dialogOffsetY: overrides.dialogOffsetY ?? 0,
    dialogTextAlign: overrides.dialogTextAlign ?? 'left',
    startEffect: overrides.startEffect ?? 'none',
    endEffect: overrides.endEffect ?? 'none',
    startEffectDurationMs: overrides.startEffectDurationMs ?? 300,
    endEffectDurationMs: overrides.endEffectDurationMs ?? 300,
    assetUrl: overrides.assetUrl ?? null,
    positionX: overrides.positionX ?? 0,
    positionY: overrides.positionY ?? 0,
    orderIndex: overrides.orderIndex ?? 0,
    isStart: overrides.isStart ?? false,
    isEnding: overrides.isEnding ?? false,
    choices: overrides.choices ?? []
  };
}

function buildPublish(cuts: ProductPublishedCut[], startCutId: string | null = cuts[0]?.id ?? null): Publish {
  return {
    id: 'publish-1',
    projectId: 'project-1',
    episodeId: 'episode-1',
    versionNo: 1,
    status: 'published',
    manifest: {
      project: {
        id: 'project-1',
        title: 'Project',
        description: null,
        thumbnailUrl: '/uploads/project-cover.jpg',
        status: 'published'
      },
      episode: {
        id: 'episode-1',
        title: 'Episode',
        episodeNo: 1,
        coverImageUrl: null,
        status: 'published',
        startCutId,
        mode: 'standard',
        exitLoopMetadata: null
      },
      cuts
    },
    createdBy: 'user-1',
    createdAt: '2026-05-11T00:00:00.000Z'
  };
}

describe('buildFeedItem', () => {
  it('creates a feed item from the configured start cut when there are no feed choices', () => {
    const item = buildFeedItem(buildPublish([buildCut({ id: 'cut-start', isStart: true })], 'cut-start'));

    expect(item).not.toBeNull();
    expect(item?.startCut.id).toBe('cut-start');
    expect(item?.startChoices).toHaveLength(0);
  });

  it('prefers the first cut with at least two feed choices', () => {
    const item = buildFeedItem(
      buildPublish(
        [
          buildCut({ id: 'cut-start', isStart: true, orderIndex: 0 }),
          buildCut({
            id: 'cut-choices',
            kind: 'choice',
            orderIndex: 1,
            choices: [
              buildChoice({ id: 'choice-a', label: 'A', orderIndex: 0, nextCutId: 'cut-a' }),
              buildChoice({ id: 'choice-b', label: 'B', orderIndex: 1, nextCutId: 'cut-b' })
            ]
          })
        ],
        'cut-start'
      )
    );

    expect(item).not.toBeNull();
    expect(item?.startCut.id).toBe('cut-choices');
    expect(item?.startChoices.map((choice) => choice.id)).toEqual(['choice-a', 'choice-b']);
  });
});
