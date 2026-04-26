import type { PublishManifest } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CutContentBlocksView } from '../src/widgets/content-blocks/CutContentBlocksView';
import { ViewerCutCard } from '../src/widgets/public-viewer/ViewerCutCard';

type TriggerableIntersectionObserverGlobal = typeof globalThis & {
  __triggerIntersection?: (element: Element, ratio?: number) => void;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

function mockElementRects(rectsByTestId: Record<string, { bottom: number; height: number; top: number; width: number }>) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect() {
    if (this instanceof HTMLElement) {
      const rect = rectsByTestId[this.dataset.testid ?? ''];

      if (rect) {
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: 20,
          right: 20 + rect.width,
          top: rect.top,
          width: rect.width,
          x: 20,
          y: rect.top,
          toJSON: () => ({})
        };
      }
    }

    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({})
    };
  });
}

describe('ViewerCutCard', () => {
  it('splits overlay and flow content by placement', async () => {
    let isFlowAboveRevealLine = false;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect() {
      if (this instanceof HTMLElement && this.dataset.testid === 'content-block-reveal-cut-1:flow:flow-1') {
        return {
          bottom: isFlowAboveRevealLine ? 180 : 780,
          height: 80,
          left: 20,
          right: 260,
          top: isFlowAboveRevealLine ? 100 : 700,
          width: 240,
          x: 20,
          y: isFlowAboveRevealLine ? 100 : 700,
          toJSON: () => ({})
        };
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };
    });

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

    expect(screen.getByLabelText('Overlay line').className).toContain('text-[clamp(1.4375rem');
    expect(screen.getByText('Hero')).toBeTruthy();
    const flowLine = within(screen.getByTestId('viewer-flow-content')).getByText('Flow line');
    const flowReveal = screen.getByTestId('content-block-reveal-cut-1:flow:flow-1');
    expect(flowLine.className).toContain('text-[clamp(0.75rem');
    expect(flowLine.className).toContain('leading-loose');
    expect(flowReveal.className).toContain('mt-4');
    expect(flowReveal.className).toContain('mb-8');
    expect(flowReveal.getAttribute('data-content-revealed')).toBe('false');

    await act(async () => {
      isFlowAboveRevealLine = true;
      (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(flowReveal, 1);
    });

    expect(flowReveal.getAttribute('data-content-revealed')).toBe('true');
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

  it('places overlay dialogue at intermediate vertical anchors', () => {
    const cut = buildViewerCut({
      dialogAnchorY: 'center',
      dialogOffsetY: 12,
      contentBlocks: [
        {
          id: 'overlay-1',
          type: 'narration',
          text: 'Centered overlay',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay'
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

    expect(screen.getByText('Centered overlay')).toBeTruthy();
    const positionedPanel = container.querySelector<HTMLElement>('[style*="top: 50%"]');
    expect(positionedPanel?.getAttribute('style')).toContain('translateY(calc(-50% + 12px))');
  });

  it('centers overlay dialogue horizontally with an optional x offset', () => {
    const cut = buildViewerCut({
      dialogAnchorX: 'center',
      dialogOffsetX: 18,
      contentBlocks: [
        {
          id: 'overlay-1',
          type: 'narration',
          text: 'Centered horizontal overlay',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay'
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

    const placementRoot = container.querySelector<HTMLElement>('.justify-center');
    const positionedPanel = container.querySelector<HTMLElement>('[style*="translateX(18px)"]');

    expect(placementRoot).toBeTruthy();
    expect(positionedPanel?.getAttribute('style')).not.toContain('margin-left');
    expect(positionedPanel?.getAttribute('style')).not.toContain('margin-right');
  });

  it('reveals upper overlay text when it is already above the trigger line', async () => {
    mockElementRects({
      'content-block-reveal-cut-1:overlay:upper-overlay': {
        bottom: 180,
        height: 80,
        top: 100,
        width: 240
      }
    });

    const cut = buildViewerCut({
      dialogAnchorY: 'upper',
      contentBlocks: [
        {
          id: 'upper-overlay',
          type: 'narration',
          text: 'Upper narration',
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

    const revealRoot = screen.getByTestId('content-block-reveal-cut-1:overlay:upper-overlay');

    await waitFor(() => {
      expect(revealRoot.getAttribute('data-content-revealed')).toBe('true');
    });
  });

  it('does not reveal text from an observer event while the block box is below the lower fifth trigger line', async () => {
    mockElementRects({
      'content-block-reveal-cut-1:flow:delayed-flow': {
        bottom: 800,
        height: 80,
        top: 720,
        width: 240
      }
    });

    const cut = buildViewerCut({
      contentBlocks: [
        {
          id: 'delayed-flow',
          type: 'narration',
          text: 'Wait for the block box',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
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

    const revealRoot = screen.getByTestId('content-block-reveal-cut-1:flow:delayed-flow');

    await act(async () => {
      (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(revealRoot, 1);
    });

    expect(revealRoot.getAttribute('data-content-revealed')).toBe('false');
  });

  it('reveals delayed text from the viewer scroll container when the block box reaches the lower fifth trigger line', async () => {
    let isBlockAboveRevealLine = false;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect() {
      if (this instanceof HTMLElement && this.dataset.testid === 'viewer-scroll-root') {
        return {
          bottom: 500,
          height: 500,
          left: 0,
          right: 320,
          top: 0,
          width: 320,
          x: 0,
          y: 0,
          toJSON: () => ({})
        };
      }

      if (this instanceof HTMLElement && this.dataset.testid === 'content-block-reveal-scroll-cut:flow:scroll-flow') {
        return {
          bottom: isBlockAboveRevealLine ? 390 : 530,
          height: 80,
          left: 20,
          right: 260,
          top: isBlockAboveRevealLine ? 310 : 450,
          width: 240,
          x: 20,
          y: isBlockAboveRevealLine ? 310 : 450,
          toJSON: () => ({})
        };
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };
    });

    const cut = buildViewerCut({
      id: 'scroll-cut',
      contentBlocks: [
        {
          id: 'scroll-flow',
          type: 'narration',
          text: 'Scroll container reveals me',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        }
      ]
    });

    render(
      <div data-testid="viewer-scroll-root" style={{ height: '500px', overflowY: 'auto' }}>
        <CutContentBlocksView bindings={{ userName: '' }} cut={cut} placement="flow" />
      </div>
    );

    const scrollRoot = screen.getByTestId('viewer-scroll-root');
    const revealRoot = screen.getByTestId('content-block-reveal-scroll-cut:flow:scroll-flow');

    await act(async () => {
      (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(revealRoot, 1);
    });

    expect(revealRoot.getAttribute('data-content-revealed')).toBe('false');

    await act(async () => {
      isBlockAboveRevealLine = true;
      scrollRoot.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(revealRoot.getAttribute('data-content-revealed')).toBe('true');
    });
  });

  it('applies edge fade mask and cut bottom spacing to image cuts', () => {
    const cut = buildViewerCut({
      assetUrl: '/scene.jpg',
      edgeFade: 'both',
      edgeFadeIntensity: 'minimal',
      edgeFadeColor: 'white',
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
    expect(image.getAttribute('style')).toContain('black 99.5%');
    expect(container.querySelector('.bg-gradient-to-t')).toBeTruthy();
    expect(container.querySelector('.bg-gradient-to-b')).toBeTruthy();
    expect(container.querySelector('.from-white')).toBeTruthy();
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
    let isDialogueAboveRevealLine = false;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect() {
      if (this instanceof HTMLElement && this.dataset.testid === 'content-block-reveal-typewriter-cut:overlay:typewriter-dialogue') {
        return {
          bottom: isDialogueAboveRevealLine ? 180 : 780,
          height: 80,
          left: 20,
          right: 260,
          top: isDialogueAboveRevealLine ? 100 : 700,
          width: 240,
          x: 20,
          y: isDialogueAboveRevealLine ? 100 : 700,
          toJSON: () => ({})
        };
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };
    });

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
    const revealRoot = screen.getByTestId('content-block-reveal-typewriter-cut:overlay:typewriter-dialogue');
    const typewriter = screen.getByTestId('dialogue-typewriter-visible-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line');

    expect(typewriter.textContent).not.toBe('Prompt-like line');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(28 * ('Prompt-like line'.length + 1));
    });

    expect(screen.getByTestId('dialogue-typewriter-visible-typewriter-cut:overlay:typewriter-dialogue:Prompt-like line').textContent).toBe('');
    expect(revealRoot.getAttribute('data-content-revealed')).toBe('false');

    await act(async () => {
      isDialogueAboveRevealLine = true;
      (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(revealRoot, 1);
    });

    expect(revealRoot.getAttribute('data-content-revealed')).toBe('true');

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
