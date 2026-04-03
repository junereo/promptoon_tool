import type { FeedResponse } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainFeedPage } from '../src/pages/MainFeedPage';

type TriggerableIntersectionObserverGlobal = typeof globalThis & {
  __triggerIntersection?: (element: Element, ratio?: number) => void;
};

const trackImpressionMock = vi.fn();
const trackChoiceClickMock = vi.fn();
const fetchNextPageMock = vi.fn(() => Promise.resolve());
const imageSources: string[] = [];

let feedResponse: FeedResponse;

vi.mock('../src/features/feed/hooks/use-feed-query', () => ({
  useFeedQuery: () => ({
    data: {
      pages: [feedResponse]
    },
    fetchNextPage: fetchNextPageMock,
    hasNextPage: false,
    isError: false,
    isFetchingNextPage: false,
    isLoading: false
  })
}));

vi.mock('../src/features/feed/hooks/use-feed-telemetry', () => ({
  useFeedTelemetry: () => ({
    trackImpression: trackImpressionMock,
    trackChoiceClick: trackChoiceClickMock
  })
}));

function LocationDisplay() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  trackImpressionMock.mockReset();
  trackChoiceClickMock.mockReset();
  fetchNextPageMock.mockReset();
  imageSources.length = 0;

  class ImageMock {
    set src(value: string) {
      imageSources.push(value);
    }
  }

  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: ImageMock
  });

  feedResponse = {
    items: [
      {
        publishId: 'publish-1',
        episodeId: 'episode-1',
        projectId: 'project-1',
        episodeTitle: 'Episode 1',
        projectTitle: 'Project 1',
        publishedAt: new Date().toISOString(),
        startCut: {
          id: 'cut-1',
          title: 'Cut 1',
          body: '첫 번째 선택입니다.',
          assetUrl: 'https://cdn.example.com/1.jpg',
          dialogAnchorX: 'left',
          dialogAnchorY: 'bottom',
          dialogOffsetX: 0,
          dialogOffsetY: 0,
          dialogTextAlign: 'left',
          startEffect: 'none',
          endEffect: 'none',
          startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS
        },
        startChoices: [
          { id: 'choice-1', label: '들어가기', orderIndex: 0, nextCutId: 'cut-2' },
          { id: 'choice-2', label: '잠김', orderIndex: 1, nextCutId: null }
        ]
      },
      {
        publishId: 'publish-2',
        episodeId: 'episode-2',
        projectId: 'project-1',
        episodeTitle: 'Episode 2',
        projectTitle: 'Project 1',
        publishedAt: new Date().toISOString(),
        startCut: {
          id: 'cut-2',
          title: 'Cut 2',
          body: '두 번째 시작입니다.',
          assetUrl: 'https://cdn.example.com/2.jpg',
          dialogAnchorX: 'left',
          dialogAnchorY: 'bottom',
          dialogOffsetX: 0,
          dialogOffsetY: 0,
          dialogTextAlign: 'left',
          startEffect: 'none',
          endEffect: 'none',
          startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS
        },
        startChoices: [{ id: 'choice-3', label: '계속', orderIndex: 0, nextCutId: 'cut-3' }]
      },
      {
        publishId: 'publish-3',
        episodeId: 'episode-3',
        projectId: 'project-2',
        episodeTitle: 'Episode 3',
        projectTitle: 'Project 2',
        publishedAt: new Date().toISOString(),
        startCut: {
          id: 'cut-3',
          title: 'Cut 3',
          body: '세 번째 시작입니다.',
          assetUrl: 'https://cdn.example.com/3.jpg',
          dialogAnchorX: 'left',
          dialogAnchorY: 'bottom',
          dialogOffsetX: 0,
          dialogOffsetY: 0,
          dialogTextAlign: 'left',
          startEffect: 'none',
          endEffect: 'none',
          startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS
        },
        startChoices: [{ id: 'choice-4', label: '계속', orderIndex: 0, nextCutId: 'cut-4' }]
      }
    ],
    nextCursor: null
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<MainFeedPage />} path="/" />
        <Route element={<LocationDisplay />} path="/v/:publishId" />
      </Routes>
    </MemoryRouter>
  );
}

describe('MainFeedPage', () => {
  it('renders feed slides, preloads the next images, and deduplicates impressions per publish', async () => {
    renderPage();

    expect(await screen.findByText('첫 번째 선택입니다.')).toBeTruthy();

    await waitFor(() => {
      expect(trackImpressionMock).toHaveBeenCalledTimes(1);
    });

    expect(imageSources).toEqual(['https://cdn.example.com/2.jpg', 'https://cdn.example.com/3.jpg']);

    const firstSlide = document.querySelector('[data-publish-id="publish-1"]');
    expect(firstSlide).toBeTruthy();

    (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(firstSlide as Element, 1);

    await waitFor(() => {
      expect(trackImpressionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('tracks feed choice clicks, navigates to the viewer, and disables unlinked choices', async () => {
    renderPage();

    const disabledChoice = await screen.findByRole('button', { name: /잠김/ });
    expect((disabledChoice as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '들어가기' }));

    await waitFor(() => {
      expect(trackChoiceClickMock).toHaveBeenCalledWith(feedResponse.items[0], 'choice-1');
    });

    expect(await screen.findByText('/v/publish-1')).toBeTruthy();
  });
});
