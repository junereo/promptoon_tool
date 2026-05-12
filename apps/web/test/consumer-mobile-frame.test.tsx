import type { FeedHomeResponse, FeedItem, FeedResponse } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../src/features/auth/store/use-auth-store';
import { ConsumerHomePage } from '../src/domains/consumer/pages/ConsumerHomePage';
import { ConsumerLibraryPage } from '../src/domains/consumer/pages/ConsumerLibraryPage';
import { ConsumerMyPage } from '../src/domains/consumer/pages/ConsumerMyPage';

const getHomeMock = vi.hoisted(() => vi.fn());
const getBookmarksMock = vi.hoisted(() => vi.fn());
const unbookmarkPublishMock = vi.hoisted(() => vi.fn());

vi.mock('../src/shared/api/feed.api', () => ({
  feedApi: {
    getHome: getHomeMock,
    getBookmarks: getBookmarksMock,
    unbookmarkPublish: unbookmarkPublishMock
  }
}));

function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    publishId: overrides.publishId ?? 'publish-1',
    episodeId: overrides.episodeId ?? 'episode-1',
    episodeTitle: overrides.episodeTitle ?? 'Saved Episode',
    projectTitle: overrides.projectTitle ?? 'Saved Project',
    coverImageUrl: overrides.coverImageUrl ?? 'https://cdn.example.com/cover.jpg',
    publishedAt: overrides.publishedAt ?? new Date().toISOString(),
    type: overrides.type ?? 'promptoon',
    startCut: {
      id: 'cut-1',
      title: 'Start',
      body: '선택형 콘텐츠 소개',
      assetUrl: 'https://cdn.example.com/start.jpg',
      dialogAnchorX: 'left',
      dialogAnchorY: 'bottom',
      dialogOffsetX: 0,
      dialogOffsetY: 0,
      dialogTextAlign: 'left',
      startEffect: 'none',
      endEffect: 'none',
      startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
      endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
      ...overrides.startCut
    },
    startChoices: [],
    ...overrides
  };
}

function renderWithProviders(path: string, element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={element} path={path.split('?')[0]} />
          <Route element={<div>Login Screen</div>} path="/login" />
          <Route element={<div>Viewer Screen</div>} path="/v/:publishId" />
          <Route element={<div>Shorts Screen</div>} path="/shorts/:publishId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getHomeMock.mockReset();
  getBookmarksMock.mockReset();
  unbookmarkPublishMock.mockReset();
  useAuthStore.setState({
    user: null,
    session: null,
    studioRole: null,
    isAuthenticated: false,
    hasHydrated: true,
    sessionStatus: 'idle'
  });
});

afterEach(() => {
  cleanup();
});

describe('consumer mobile frame', () => {
  it('renders the consumer home with 4-tab navigation', async () => {
    const item = createFeedItem({ episodeTitle: 'Home Hero Episode' });
    const home: FeedHomeResponse = {
      hero: item,
      sections: [
        {
          key: 'trending',
          title: 'trending TOP 10',
          items: [item]
        },
        {
          key: 'new',
          title: '신작',
          items: []
        },
        {
          key: 'recommended',
          title: '추천',
          items: []
        },
        {
          key: 'shorts',
          title: '숏드라마',
          items: []
        }
      ]
    };
    getHomeMock.mockResolvedValue(home);

    renderWithProviders('/', <ConsumerHomePage />);

    expect((await screen.findAllByText('Home Hero Episode')).length).toBeGreaterThan(0);
    expect(screen.queryByText('새로운 선택형 콘텐츠')).toBeNull();
    expect(screen.queryByRole('link', { name: '피드 보기' })).toBeNull();
    expect(screen.getAllByText('인기').length).toBeGreaterThan(0);
    expect(screen.getAllByText('신작').length).toBeGreaterThan(0);
    expect(screen.getAllByText('추천').length).toBeGreaterThan(0);
    expect(screen.getAllByText('모아보기').length).toBeGreaterThan(0);
    expect(screen.getAllByText('랭킹').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '앱 준비중' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('link', { name: /홈/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /^탐색$/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^보관함$/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^마이$/ })).toBeTruthy();
  });

  it('keeps unauthenticated library access inside the consumer frame', async () => {
    renderWithProviders('/library', <ConsumerLibraryPage />);

    expect(await screen.findByText('로그인하고 보관함을 확인하세요.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByText('Login Screen')).toBeNull();
  });

  it('renders authenticated library and can remove a bookmark', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: { id: 'user-1', loginId: 'viewer0001' },
      session: null,
      studioRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'valid'
    });
    getBookmarksMock.mockResolvedValue({
      items: [createFeedItem({ publishId: 'publish-saved', episodeTitle: 'Library Saved Episode' })],
      nextCursor: null
    } satisfies FeedResponse);
    unbookmarkPublishMock.mockResolvedValue(undefined);

    renderWithProviders('/library', <ConsumerLibraryPage />);

    expect(await screen.findByText('Library Saved Episode')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '저장 해제' }));

    expect(unbookmarkPublishMock).toHaveBeenCalledWith('publish-saved');
  });

  it('renders my page for guest and authenticated users', async () => {
    renderWithProviders('/my', <ConsumerMyPage />);
    expect(screen.getByText('로그인하고 내 콘텐츠를 이어보세요.')).toBeTruthy();

    cleanup();
    useAuthStore.setState({
      user: { id: 'user-1', loginId: 'viewer0001' },
      session: null,
      studioRole: 'studio_admin',
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'valid'
    });

    renderWithProviders('/my', <ConsumerMyPage />);
    expect(screen.getByText('viewer0001')).toBeTruthy();
    expect(screen.getByText('접근 가능')).toBeTruthy();
  });
});
