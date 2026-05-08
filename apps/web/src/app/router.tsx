import { Suspense, lazy, useState } from 'react';
import { Link, Navigate, Outlet, createBrowserRouter, useNavigate } from 'react-router-dom';

import { ChannelHomePage } from '../domains/channel/pages/ChannelHomePage';
import { ChannelPage } from '../domains/channel/pages/ChannelPage';
import { CommunityDiscussionPage } from '../domains/community/pages/CommunityDiscussionPage';
import { ConsumerHomePage } from '../domains/consumer/pages/ConsumerHomePage';
import { ConsumerLibraryPage } from '../domains/consumer/pages/ConsumerLibraryPage';
import { ConsumerMyPage } from '../domains/consumer/pages/ConsumerMyPage';
import { FeedHomePage } from '../domains/feed/pages/FeedHomePage';
import { MovingtoonShortViewerPage } from '../domains/feed/pages/MovingtoonShortViewerPage';
import { StudioAssetLibraryPage } from '../domains/studio/pages/StudioAssetLibraryPage';
import { StudioAnalyticsPage } from '../domains/studio/pages/StudioAnalyticsPage';
import { StudioCommunityModerationPage } from '../domains/studio/pages/StudioCommunityModerationPage';
import { StudioEpisodeEditorPage } from '../domains/studio/pages/StudioEpisodeEditorPage';
import { StudioProjectMembersPage } from '../domains/studio/pages/StudioProjectMembersPage';
import { StudioProjectDetailPage } from '../domains/studio/pages/StudioProjectDetailPage';
import { StudioProjectDashboardPage } from '../domains/studio/pages/StudioProjectDashboardPage';
import { StudioProjectSettingsPage } from '../domains/studio/pages/StudioProjectSettingsPage';
import { StudioPublishPage } from '../domains/studio/pages/StudioPublishPage';
import { StudioPublishHistoryPage } from '../domains/studio/pages/StudioPublishHistoryPage';
import { StudioSeriesPage } from '../domains/studio/pages/StudioSeriesPage';
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import { clearAuthSession } from '../features/auth/lib/auth-session';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { preloadPromptoonViewerPage } from '../features/viewer/lib/preload-viewer';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

const PromptoonViewerPage = lazy(() =>
  preloadPromptoonViewerPage().then((module) => ({ default: module.PromptoonViewerPage }))
);

function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  function handleLogout() {
    clearAuthSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="relative z-40 shrink-0 border-b border-editor-border/80 bg-black/20 backdrop-blur">
        <div className="flex h-12 w-full items-center px-3 sm:px-4">
          <button
            aria-expanded={isHeaderMenuOpen}
            aria-label="메뉴 열기"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-editor-border bg-black/20 text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            onClick={() => setIsHeaderMenuOpen((current) => !current)}
            type="button"
          >
            <span className="grid gap-1">
              <span className="block h-0.5 w-4 rounded-full bg-current" />
              <span className="block h-0.5 w-4 rounded-full bg-current" />
              <span className="block h-0.5 w-4 rounded-full bg-current" />
            </span>
          </button>
        </div>

        {isHeaderMenuOpen ? (
          <div className="absolute left-3 top-12 w-[min(22rem,calc(100vw-1.5rem))] rounded-[18px] border border-editor-border bg-editor-panel/95 p-3 shadow-2xl shadow-black/35 backdrop-blur sm:left-4">
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-zinc-50">Promptoon Authoring</p>
              <p className="text-xs text-zinc-400">State-first interactive episode editor</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="rounded-full border border-editor-border bg-black/20 px-2.5 py-1.5 text-xs uppercase tracking-[0.18em] text-zinc-400">
                {user?.loginId ?? 'anonymous'}
              </p>
              <Link
                className="rounded-full border border-editor-border bg-black/20 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                onClick={() => setIsHeaderMenuOpen(false)}
                to="/promptoon/projects"
              >
                Home
              </Link>
              <button
                className="rounded-full border border-editor-border bg-black/20 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}

type AppRouter = ReturnType<typeof createBrowserRouter>;

export const router: AppRouter = createBrowserRouter([
  {
    path: '/v/:publishId',
    element: (
      <Suspense fallback={<div className="min-h-dvh bg-black" />}>
        <PromptoonViewerPage />
      </Suspense>
    )
  },
  {
    path: '/v/:publishId/:episodeNo',
    element: (
      <Suspense fallback={<div className="min-h-dvh bg-black" />}>
        <PromptoonViewerPage />
      </Suspense>
    )
  },
  {
    path: '/promptoon/projects/:projectId/episodes/:episodeId/test-viewer',
    element: (
      <ProtectedRoute requireStudio>
        <Suspense fallback={<div className="min-h-dvh bg-black" />}>
          <PromptoonViewerPage />
        </Suspense>
      </ProtectedRoute>
    )
  },
  {
    path: '/studio/projects/:projectId/episodes/:episodeId/test-viewer',
    element: (
      <ProtectedRoute requireStudio>
        <Suspense fallback={<div className="min-h-dvh bg-black" />}>
          <PromptoonViewerPage />
        </Suspense>
      </ProtectedRoute>
    )
  },
  {
    path: '/',
    element: <ConsumerHomePage />
  },
  {
    path: '/discovery',
    element: <FeedHomePage />
  },
  {
    path: '/library',
    element: <ConsumerLibraryPage />
  },
  {
    path: '/my',
    element: <ConsumerMyPage />
  },
  {
    path: '/feed',
    element: <Navigate replace to="/discovery" />
  },
  {
    path: '/shorts/:publishId',
    element: <MovingtoonShortViewerPage />
  },
  {
    path: '/channel/:channelId',
    element: <ChannelPage />
  },
  {
    path: '/overview',
    element: <Navigate replace to="/discovery" />
  },
  {
    path: '/c/:channelSlug',
    element: <ChannelHomePage />
  },
  {
    path: '/c/:channelSlug/series',
    element: <ChannelHomePage />
  },
  {
    path: '/c/:channelSlug/shorts',
    element: <ChannelHomePage />
  },
  {
    path: '/c/:channelSlug/promptoons',
    element: <ChannelHomePage />
  },
  {
    path: '/c/:channelSlug/community',
    element: <ChannelHomePage />
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/register',
    element: <RegisterPage />
  },
  {
    path: '/community/publishes/:publishId',
    element: <CommunityDiscussionPage />
  },
  {
    path: '/promptoon',
    element: (
      <ProtectedRoute requireStudio>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate replace to="projects" />
      },
      {
        path: 'community/publishes/:publishId',
        element: <StudioCommunityModerationPage />
      },
      {
        path: 'projects',
        element: <StudioProjectDashboardPage />
      },
      {
        path: 'projects/:projectId',
        element: <StudioProjectDetailPage />
      },
      {
        path: 'projects/:projectId/series',
        element: <StudioSeriesPage />
      },
      {
        path: 'projects/:projectId/settings',
        element: <StudioProjectSettingsPage />
      },
      {
        path: 'projects/:projectId/assets',
        element: <StudioAssetLibraryPage />
      },
      {
        path: 'projects/:projectId/history',
        element: <StudioPublishHistoryPage />
      },
      {
        path: 'projects/:projectId/members',
        element: <StudioProjectMembersPage />
      },
      {
        path: 'projects/:projectId/publish',
        element: <StudioPublishPage />
      },
      {
        path: 'projects/:projectId/analytics',
        element: <StudioAnalyticsPage />
      },
      {
        path: 'projects/:projectId/episodes/:episodeId',
        element: <StudioEpisodeEditorPage />
      }
    ]
  },
  {
    path: '/studio',
    element: (
      <ProtectedRoute requireStudio>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate replace to="projects" />
      },
      {
        path: 'community/publishes/:publishId',
        element: <StudioCommunityModerationPage />
      },
      {
        path: 'projects',
        element: <StudioProjectDashboardPage />
      },
      {
        path: 'projects/:projectId',
        element: <StudioProjectDetailPage />
      },
      {
        path: 'projects/:projectId/series',
        element: <StudioSeriesPage />
      },
      {
        path: 'projects/:projectId/settings',
        element: <StudioProjectSettingsPage />
      },
      {
        path: 'projects/:projectId/assets',
        element: <StudioAssetLibraryPage />
      },
      {
        path: 'projects/:projectId/history',
        element: <StudioPublishHistoryPage />
      },
      {
        path: 'projects/:projectId/members',
        element: <StudioProjectMembersPage />
      },
      {
        path: 'projects/:projectId/publish',
        element: <StudioPublishPage />
      },
      {
        path: 'projects/:projectId/analytics',
        element: <StudioAnalyticsPage />
      },
      {
        path: 'projects/:projectId/episodes/:episodeId',
        element: <StudioEpisodeEditorPage />
      },
      {
        path: 'episodes/:episodeId/editor',
        element: <StudioEpisodeEditorPage />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate replace to="/" />
  }
]);
