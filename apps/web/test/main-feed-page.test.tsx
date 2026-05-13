import type { FeedResponse } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MainFeedPage } from '../src/pages/MainFeedPage';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

type TriggerableIntersectionObserverGlobal = typeof globalThis & {
  __triggerIntersection?: (element: Element, ratio?: number) => void;
};

const trackImpressionMock = vi.fn();
const trackChoiceClickMock = vi.fn();
const fetchNextPageMock = vi.fn(() => Promise.resolve());
const preloadViewerForPublishMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const imageSources: string[] = [];
const playMediaMock = vi.fn(() => Promise.resolve());
const pauseMediaMock = vi.fn();
const originalPlayMedia = HTMLMediaElement.prototype.play;
const originalPauseMedia = HTMLMediaElement.prototype.pause;

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

vi.mock('../src/features/viewer/lib/preload-viewer', () => ({
  preloadViewerForPublish: preloadViewerForPublishMock
}));

function LocationDisplay() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

afterEach(() => {
  cleanup();
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: originalPlayMedia
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: originalPauseMedia
  });
});

beforeEach(() => {
  trackImpressionMock.mockReset();
  trackChoiceClickMock.mockReset();
  fetchNextPageMock.mockReset();
  preloadViewerForPublishMock.mockReset();
  preloadViewerForPublishMock.mockResolvedValue(undefined);
  playMediaMock.mockClear();
  pauseMediaMock.mockClear();
  imageSources.length = 0;
  useAuthStore.setState({
    user: null,
    session: null,
    isAuthenticated: false,
    hasHydrated: true,
    sessionStatus: 'idle'
  });

  class ImageMock {
    set src(value: string) {
      imageSources.push(value);
    }
  }

  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: ImageMock
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: playMediaMock
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: pauseMediaMock
  });

  feedResponse = {
    items: [
      {
        publishId: 'publish-1',
        episodeId: 'episode-1',
        isExperimental: true,
        channelAvatarUrl: 'https://cdn.example.com/channel-avatar.webp',
        channelName: 'Serial Studio',
        channelSlug: 'serial-studio',
        episodeTitle: 'Episode 1',
        projectTitle: 'Project 1',
        coverImageUrl: 'https://cdn.example.com/cover-1.jpg',
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
        episodeTitle: 'Episode 2',
        projectTitle: 'Project 1',
        coverImageUrl: 'https://cdn.example.com/cover-2.jpg',
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
        episodeTitle: 'Episode 3',
        projectTitle: 'Project 2',
        coverImageUrl: null,
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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainFeedPage />} path="/" />
          <Route element={<div>Login Screen</div>} path="/login" />
          <Route element={<LocationDisplay />} path="/v/:publishId" />
          <Route element={<LocationDisplay />} path="/c/:channelSlug/community" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MainFeedPage', () => {
  it('renders feed slides, preloads the next images, and deduplicates impressions per publish', async () => {
    renderPage();

    expect(await screen.findByText('Episode 1')).toBeTruthy();
    expect(screen.getByTestId('feed-banner-slide')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Promptoon Instagram' }).getAttribute('href')).toBe(
      'https://www.instagram.com/promptoon_ai/'
    );
    expect(screen.getByRole('link', { name: '프롬툰 설문 조사' }).getAttribute('href')).toBe(
      'https://forms.gle/WhsQ9jH7WVg9UUjK6'
    );
    expect(document.querySelector('img[src="https://cdn.example.com/channel-avatar.webp"]')).toBeTruthy();
    expect(screen.getByText('실험용')).toBeTruthy();

    await waitFor(() => {
      expect(trackImpressionMock).toHaveBeenCalledTimes(1);
    });

    expect(imageSources).toEqual(['https://cdn.example.com/cover-2.jpg', 'https://cdn.example.com/3.jpg']);

    const firstSlide = document.querySelector('[data-publish-id="publish-1"]');
    expect(firstSlide).toBeTruthy();

    (globalThis as TriggerableIntersectionObserverGlobal).__triggerIntersection?.(firstSlide as Element, 1);

    await waitFor(() => {
      expect(trackImpressionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('opens the viewer only from the CTA button without rendering choices', async () => {
    renderPage();

    expect(screen.queryByRole('button', { name: '들어가기' })).toBeNull();
    expect(screen.queryByRole('button', { name: /잠김/ })).toBeNull();

    const firstSlide = await screen.findByText('Episode 1');
    fireEvent.click(firstSlide);
    expect(screen.queryByText('/v/publish-1')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: '지금 보기' })[0]);
    expect(trackChoiceClickMock).not.toHaveBeenCalled();
    expect(preloadViewerForPublishMock).toHaveBeenCalledWith('publish-1');
    expect(await screen.findByText('/v/publish-1')).toBeTruthy();
  });

  it('renders movingtoon video playback controls in the feed', async () => {
    feedResponse = {
      ...feedResponse,
      items: [
        {
          ...feedResponse.items[0],
          type: 'short_drama',
          videoUrl: 'https://cdn.example.com/movingtoon-1.mp4',
          durationSec: 15
        },
        ...feedResponse.items.slice(1)
      ]
    };

    renderPage();

    const video = await screen.findByLabelText('Episode 1 영상');
    const player = screen.getByTestId('movingtoon-video-player');
    expect(video.getAttribute('src')).toBe('https://cdn.example.com/movingtoon-1.mp4');
    expect(screen.getByRole('button', { name: '영상 정지' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '음소거 해제' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: '영상 진행 위치' })).toBeNull();

    fireEvent.pointerEnter(player);
    fireEvent.click(screen.getByRole('button', { name: '음소거 해제' }));
    expect(screen.getByRole('button', { name: '음소거' })).toBeTruthy();
    expect(pauseMediaMock).not.toHaveBeenCalled();

    fireEvent.click(player);
    expect(pauseMediaMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '영상 시작' })).toBeTruthy();
    expect(screen.getByText('시작')).toBeTruthy();

    fireEvent.click(player);
    expect(playMediaMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '영상 정지' })).toBeTruthy();
    expect(screen.getByText('정지')).toBeTruthy();
  });

  it('preloads on CTA intent and shows progress until preload finishes', async () => {
    let resolvePreload: (() => void) | null = null;
    preloadViewerForPublishMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        })
    );

    renderPage();

    const ctaButton = (await screen.findAllByRole('button', { name: '지금 보기' }))[0];

    fireEvent.pointerEnter(ctaButton);
    expect(preloadViewerForPublishMock).toHaveBeenCalledWith('publish-1');

    fireEvent.click(ctaButton);

    expect((await screen.findByRole('button', { name: '여는 중...' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('feed-open-progress')).toBeTruthy();
    expect(screen.queryByText('/v/publish-1')).toBeNull();

    resolvePreload?.();

    expect(await screen.findByText('/v/publish-1')).toBeTruthy();
  });

  it('still navigates when viewer preload fails', async () => {
    preloadViewerForPublishMock.mockRejectedValue(new Error('preload failed'));

    renderPage();

    fireEvent.click((await screen.findAllByRole('button', { name: '지금 보기' }))[0]);

    expect(await screen.findByText('/v/publish-1')).toBeTruthy();
  });

  it('redirects unauthenticated interaction actions to login', async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole('button', { name: '좋아요' }))[0]);

    expect(await screen.findByText('Login Screen')).toBeTruthy();
  });
});
