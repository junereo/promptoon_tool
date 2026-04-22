import type { Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import {
  buildScriptPatch,
  exportCutsToScript,
  parseScriptJson
} from '../src/shared/lib/script-sync';

function buildCut(overrides?: Partial<Cut>): Cut {
  return {
    id: 'cut-1',
    episodeId: 'episode-1',
    kind: 'scene',
    title: 'Opening',
    body: 'Old body',
    contentBlocks: [
      {
        id: 'dialogue-1',
        type: 'dialogue',
        speaker: 'Hero',
        text: 'Old line',
        textAlign: 'left',
        fontToken: 'sans-kr',
        fontSizeToken: 'lg',
        lineHeightToken: 'relaxed',
        marginTopToken: 'sm',
        marginBottomToken: 'lg',
        placement: 'overlay'
      },
      {
        id: 'image-1',
        type: 'image',
        assetUrl: '/image.png',
        alt: 'Scene'
      }
    ],
    contentViewMode: 'default',
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
    positionY: 0,
    orderIndex: 0,
    isStart: false,
    isEnding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('script-sync', () => {
  it('exports only editable text blocks and includes dialogue speaker', () => {
    expect(exportCutsToScript([buildCut()])).toEqual([
      {
        cutId: 'cut-1',
        cutTitle: 'Opening',
        blocks: [
          {
            blockId: 'dialogue-1',
            type: 'dialogue',
            speaker: 'Hero',
            text: 'Old line'
          }
        ]
      }
    ]);
  });

  it('builds text-only patches without changing style metadata', () => {
    const result = buildScriptPatch(
      [buildCut()],
      [
        {
          cutId: 'cut-1',
          cutTitle: 'Changed title ignored',
          blocks: [
            {
              blockId: 'dialogue-1',
              type: 'dialogue',
              speaker: 'Guide',
              text: 'New line'
            }
          ]
        }
      ]
    );

    expect(result.warnings).toEqual([]);
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0]?.patch.body).toBe('New line');
    expect(result.patches[0]?.patch.contentBlocks?.[0]).toMatchObject({
      id: 'dialogue-1',
      type: 'dialogue',
      speaker: 'Guide',
      text: 'New line',
      textAlign: 'left',
      fontToken: 'sans-kr',
      fontSizeToken: 'lg',
      lineHeightToken: 'relaxed',
      marginTopToken: 'sm',
      marginBottomToken: 'lg',
      placement: 'overlay'
    });
    expect(result.patches[0]?.patch).not.toHaveProperty('title');
  });

  it('accepts empty text and clears the derived body', () => {
    const result = buildScriptPatch(
      [buildCut()],
      [
        {
          cutId: 'cut-1',
          cutTitle: 'Opening',
          blocks: [
            {
              blockId: 'dialogue-1',
              type: 'dialogue',
              speaker: '',
              text: ''
            }
          ]
        }
      ]
    );

    expect(result.patches[0]?.patch.body).toBe('');
    expect(result.patches[0]?.patch.contentBlocks?.[0]).toMatchObject({
      speaker: '',
      text: ''
    });
  });

  it('warns and skips unknown ids and mismatched types', () => {
    const result = buildScriptPatch(
      [buildCut()],
      [
        {
          cutId: 'missing-cut',
          cutTitle: 'Missing',
          blocks: []
        },
        {
          cutId: 'cut-1',
          cutTitle: 'Opening',
          blocks: [
            { blockId: 'missing-block', type: 'narration', text: 'Skip' },
            { blockId: 'dialogue-1', type: 'narration', text: 'Skip mismatch' }
          ]
        }
      ]
    );

    expect(result.patches).toEqual([]);
    expect(result.warnings).toEqual([
      'Unknown cutId skipped: missing-cut',
      'Unknown blockId skipped in Opening: missing-block',
      'Type mismatch skipped for block dialogue-1: expected dialogue, received narration'
    ]);
  });

  it('returns raw JSON parse errors and shape validation errors', () => {
    expect(parseScriptJson('{').errors[0]).toContain('JSON');
    expect(parseScriptJson(JSON.stringify([{ cutId: 'cut-1', cutTitle: 'Opening', blocks: [{ blockId: 'b1', type: 'dialogue' }] }])).errors).toEqual([
      'Block at cut 0, index 0 is missing string text.'
    ]);
  });
});
