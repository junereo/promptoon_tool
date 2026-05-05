import type { ChannelHome } from '@promptoon/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChannelHomePage } from '../src/domains/channel/pages/ChannelHomePage';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

const getChannelHomeMock = vi.hoisted(() => vi.fn());
const getSubscriptionStateMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const unsubscribeMock = vi.hoisted(() => vi.fn());
const trackEventMock = vi.hoisted(() => vi.fn());

vi.mock('../src/shared/api/channel.api', () => ({
  channelApi: {
    getChannelHome: getChannelHomeMock,
    getSubscriptionState: getSubscriptionStateMock,
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock
  }
}));

vi.mock('../src/shared/api/telemetry.api', () => ({
  telemetryApi: {
    trackEvent: trackEventMock
  }
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function createChannelHome(overrides: Partial<ChannelHome> = {}): ChannelHome {
  return {
    profile: {
      id: 'channel-1',
      slug: 'serial-studio',
      displayName: 'Serial Studio',
      handle: '@serial-studio',
      avatarUrl: null,
      bannerUrl: null,
      bio: '짧고 강한 분기형 드라마를 만듭니다.',
      isVerified: false,
      subscriberCount: 1200,
      likeCount: 330,
      seriesCount: 1,
      episodeCount: 2,
      shortCount: 1
    },
    featuredSeries: [
      {
        id: 'series-1',
        title: '도시의 선택',
        slug: 'city-choice',
        description: '매 회차 선택이 결말을 바꿉니다.',
        coverImageUrl: 'https://cdn.example.com/series.jpg',
        episodeCount: 2,
        status: 'ongoing'
      }
    ],
    latestEpisodes: [
      {
        id: 'episode-1',
        publishId: 'publish-1',
        title: '새 에피소드',
        episodeNo: 3,
        thumbnailUrl: 'https://cdn.example.com/episode.jpg',
        publishedAt: new Date().toISOString()
      }
    ],
    latestShorts: [
      {
        id: 'short-1',
        title: '15초 예고편',
        thumbnailUrl: 'https://cdn.example.com/short.jpg',
        videoUrl: null,
        durationSec: 15,
        publishId: 'publish-1'
      }
    ],
    communityMeta: {
      commentCount: 23,
      latestCommentAt: new Date().toISOString()
    },
    ...overrides
  };
}

function renderChannelPage(initialEntry = '/c/serial-studio') {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<ChannelHomePage />} path="/c/:channelSlug" />
          <Route element={<ChannelHomePage />} path="/c/:channelSlug/*" />
          <Route element={<div>Login Screen</div>} path="/login" />
          <Route element={<div>Viewer Screen</div>} path="/v/:publishId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  getChannelHomeMock.mockReset();
  getSubscriptionStateMock.mockReset();
  subscribeMock.mockReset();
  unsubscribeMock.mockReset();
  trackEventMock.mockReset();
  trackEventMock.mockResolvedValue(undefined);
  getSubscriptionStateMock.mockResolvedValue({
    channelId: 'channel-1',
    subscribed: false,
    subscriberCount: 1200
  });
  subscribeMock.mockResolvedValue(undefined);
  unsubscribeMock.mockResolvedValue(undefined);
  useAuthStore.setState({
    token: null,
    user: null,
    session: null,
    isAuthenticated: false,
    hasHydrated: true,
    sessionStatus: 'idle'
  });
});

describe('ChannelHomePage', () => {
  it('shows loading and error states', async () => {
    getChannelHomeMock.mockReturnValue(new Promise(() => undefined));
    const loading = renderChannelPage();

    expect(screen.getByText('채널을 불러오는 중입니다.')).toBeTruthy();
    loading.unmount();

    getChannelHomeMock.mockRejectedValue(new Error('not found'));
    renderChannelPage();

    expect(await screen.findByText('채널을 찾을 수 없습니다.')).toBeTruthy();
  });

  it('renders empty projection sections cleanly', async () => {
    getChannelHomeMock.mockResolvedValue(createChannelHome({
      featuredSeries: [],
      latestEpisodes: [],
      latestShorts: [],
      communityMeta: {
        commentCount: 0,
        latestCommentAt: null
      }
    }));

    renderChannelPage();

    expect(await screen.findByText('Serial Studio')).toBeTruthy();
    expect(screen.getByText('대표 시리즈가 아직 없습니다.')).toBeTruthy();
    expect(screen.getByText('발행된 에피소드가 아직 없습니다.')).toBeTruthy();
    expect(screen.getByText('등록된 숏드라마가 없습니다.')).toBeTruthy();
    expect(screen.getByText('댓글 0개')).toBeTruthy();
  });

  it('redirects unauthenticated subscribe attempts to login', async () => {
    getChannelHomeMock.mockResolvedValue(createChannelHome());

    renderChannelPage();

    fireEvent.click(await screen.findByRole('button', { name: '구독' }));

    expect(await screen.findByText('Login Screen')).toBeTruthy();
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it('renders latest episode, short, community metadata, and sends channel telemetry', async () => {
    getChannelHomeMock.mockResolvedValue(createChannelHome());

    renderChannelPage();

    expect(await screen.findByText('Serial Studio')).toBeTruthy();
    expect(screen.getByText('도시의 선택')).toBeTruthy();
    expect(screen.getByText('새 에피소드')).toBeTruthy();
    expect(screen.getByText('15초 예고편')).toBeTruthy();
    expect(screen.getByText('댓글 23개')).toBeTruthy();

    await waitFor(() => {
      expect(trackEventMock).toHaveBeenCalledWith({
        eventName: 'channel_view',
        channelId: 'channel-1',
        payload: {
          slug: 'serial-studio'
        }
      });
    });
  });

  it('uses the channel sub-route to focus visible sections and active tab state', async () => {
    getChannelHomeMock.mockResolvedValue(createChannelHome());

    const seriesRoute = renderChannelPage('/c/serial-studio/series');

    expect(await screen.findByRole('heading', { name: '대표 시리즈' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '시리즈' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('heading', { name: '숏드라마' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '커뮤니티' })).toBeNull();
    seriesRoute.unmount();

    getChannelHomeMock.mockResolvedValue(createChannelHome());
    const shortsRoute = renderChannelPage('/c/serial-studio/shorts');

    expect(await screen.findByRole('heading', { name: '숏드라마' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '숏드라마' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('heading', { name: '대표 시리즈' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '최신 에피소드' })).toBeNull();
    shortsRoute.unmount();

    getChannelHomeMock.mockResolvedValue(createChannelHome());
    renderChannelPage('/c/serial-studio/community');

    expect(await screen.findByRole('heading', { name: '커뮤니티' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '커뮤니티' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('heading', { name: '숏드라마' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '대표 시리즈' })).toBeNull();
  });

  it('loads subscription state and toggles subscribe for authenticated users', async () => {
    getChannelHomeMock.mockResolvedValue(createChannelHome());
    useAuthStore.setState({
      token: 'token-1',
      user: { id: 'user-1', loginId: 'viewer0001' },
      session: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'valid'
    });

    renderChannelPage();

    const button = await screen.findByRole('button', { name: '구독' });

    await waitFor(() => {
      expect(getSubscriptionStateMock).toHaveBeenCalledWith('channel-1');
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledWith('channel-1');
    });
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });
});
