import type { PublishManifest } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ViewerCutCard } from '../src/widgets/public-viewer/ViewerCutCard';

type TriggerableIntersectionObserverGlobal = typeof globalThis & {
  __triggerIntersection?: (element: Element, ratio?: number) => void;
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
          type: 'dialogue',
          speaker: 'Hero',
          text: 'Overlay line',
          textAlign: 'left',
          fontToken: 'serif-kr',
          placement: 'overlay',
          fontSizeToken: '3xl'
        },
        {
          id: 'flow-1',
          type: 'narration',
          text: 'Flow line',
          textAlign: 'left',
          fontToken: 'sans-kr',
          fontSizeToken: 'sm',
          lineHeightToken: 'loose',
          marginTopToken: 'sm',
          marginBottomToken: 'base'
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

    expect(screen.getByLabelText('Overlay line').className).toContain('text-3xl');
    expect(screen.getByText('Hero')).toBeTruthy();
    const flowLine = within(screen.getByTestId('viewer-flow-content')).getByText('Flow line');
    expect(flowLine.className).toContain('text-sm');
    expect(flowLine.className).toContain('leading-loose');
    expect(flowLine.className).toContain('mt-4');
    expect(flowLine.className).toContain('mb-8');
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

  it('applies edge fade mask and cut bottom spacing to image cuts', () => {
    const cut = buildViewerCut({
      assetUrl: '/scene.jpg',
      edgeFade: 'both',
      edgeFadeIntensity: 'strong',
      marginBottomToken: 'lg'
    });

    const { container } = render(
      <ViewerCutCard
        cut={cut}
        showChoices={false}
        showEndingActions={false}
        visibleChoices={[]}
      />
    );

    const article = container.querySelector('article');
    const image = screen.getByAltText('Scene');

    expect(article?.className).toContain('mb-16');
    expect(image.getAttribute('style')).toContain('mask-image');
    expect(image.getAttribute('style')).toContain('black 72%');
    expect(container.querySelector('.bg-gradient-to-t')).toBeTruthy();
    expect(container.querySelector('.bg-gradient-to-b')).toBeTruthy();
  });

  it('centers flow text within cut bottom spacing height', () => {
    const cut = buildViewerCut({
      assetUrl: '/scene.jpg',
      edgeFade: 'bottom',
      marginBottomToken: 'xl',
      contentBlocks: [
        {
          id: 'flow-1',
          type: 'narration',
          text: 'Centered flow',
          textAlign: 'center',
          fontToken: 'sans-kr',
          placement: 'flow'
        }
      ]
    });

    const { container } = render(
      <ViewerCutCard
        cut={cut}
        showChoices={false}
        showEndingActions={false}
        visibleChoices={[]}
      />
    );

    const article = container.querySelector('article');
    const flowContent = screen.getByTestId('viewer-flow-content');

    expect(article?.className).not.toContain('mb-32');
    expect(flowContent.className).toContain('flex');
    expect(flowContent.className).toContain('items-center');
    expect(flowContent.getAttribute('style')).toContain('min-height: 128px');
    expect(container.querySelector('.bg-gradient-to-t')).toBeTruthy();
  });

  it('types dialogue text once and keeps it visible on repeat renders', async () => {
    vi.useFakeTimers();

    const cut = buildViewerCut({
      id: 'typewriter-cut',
      contentBlocks: [
        {
          id: 'typewriter-dialogue',
          type: 'dialogue',
          speaker: 'Hero',
          text: 'Prompt-like line',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay'
        }
      ]
    });

    const { unmount } = render(
      <ViewerCutCard
        cut={cut}
        showChoices={false}
        showEndingActions={false}
        visibleChoices={[]}
      />
    );
    const typewriterRoot = screen.getByTestId('dialogue-typewriter-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line');
    const typewriter = screen.getByTestId('dialogue-typewriter-visible-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line');

    expect(typewriter.textContent).not.toBe('Prompt-like line');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(28 * ('Prompt-like line'.length + 1));
    });

    expect(screen.getByTestId('dialogue-typewriter-visible-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line').textContent).toBe('');

    await act(async () => {
      (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(typewriterRoot, 1);
    });

    for (let index = 0; index < 'Prompt-like line'.length + 1; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(28);
      });
    }

    expect(screen.getByTestId('dialogue-typewriter-visible-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line').textContent).toContain('Prompt-like line');

    unmount();
    render(
      <ViewerCutCard
        cut={cut}
        showChoices={false}
        showEndingActions={false}
        visibleChoices={[]}
      />
    );

    expect(screen.getByTestId('dialogue-typewriter-visible-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line').textContent).toContain('Prompt-like line');
  });
});
