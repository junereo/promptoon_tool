import type { PublishManifest } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ViewerCutCard } from '../src/widgets/public-viewer/ViewerCutCard';

afterEach(() => {
  cleanup();
});

function buildViewerCut(overrides?: Partial<PublishManifest['cuts'][number]>): PublishManifest['cuts'][number] {
  return {
    id: 'cut-1',
    kind: 'scene',
    title: 'Scene',
    body: '',
    contentBlocks: [],
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
    choices: [],
    ...overrides
  };
}

describe('ViewerCutCard', () => {
  it('splits overlay and flow content by placement', () => {
    const cut = buildViewerCut({
      contentBlocks: [
        {
          id: 'overlay-1',
          type: 'quote',
          title: 'Hero',
          text: 'Overlay line',
          textAlign: 'left',
          fontToken: 'serif-kr',
          placement: 'overlay'
        },
        {
          id: 'flow-1',
          type: 'narration',
          text: 'Flow line',
          textAlign: 'left',
          fontToken: 'sans-kr'
        }
      ]
    });

    render(
      <ViewerCutCard
        cut={cut}
        showChoices={false}
        showEndingActions={false}
        visibleChoices={[]}
      />
    );

    expect(screen.getByText('Overlay line')).toBeTruthy();
    expect(within(screen.getByTestId('viewer-flow-content')).getByText('Flow line')).toBeTruthy();
  });

  it('does not render an empty flow wrapper for all-overlay cuts', () => {
    const cut = buildViewerCut({
      contentBlocks: [
        {
          id: 'overlay-1',
          type: 'narration',
          text: 'Only overlay',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay'
        }
      ]
    });

    render(
      <ViewerCutCard
        cut={cut}
        showChoices={false}
        showEndingActions={false}
        visibleChoices={[]}
      />
    );

    expect(screen.getByText('Only overlay')).toBeTruthy();
    expect(screen.queryByTestId('viewer-flow-content')).toBeNull();
  });
});
