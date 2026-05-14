import { Suspense, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, createBrowserRouter, useNavigate } from 'react-router-dom';

import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import { clearAuthSession } from '../features/auth/lib/auth-session';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import {
  AboutPage,
  ChannelHomePage,
  ChannelPage,
  CommunityDiscussionPage,
  ConsumerHomePage,
  ConsumerExperimentalPage,
  ConsumerLibraryPage,
  ConsumerMyPage,
  FeedHomePage,
  LegalDocumentPage,
  LoginPage,
  MovingtoonShortViewerPage,
  PromptoonViewerPage,
  RegisterPage,
  StudioAnalyticsPage,
  StudioAssetLibraryPage,
  StudioCommunityModerationPage,
  StudioEpisodeEditorPage,
  StudioProjectDashboardPage,
  StudioProjectDetailPage,
  StudioProjectMembersPage,
  StudioProjectSettingsPage,
  StudioPublishHistoryPage,
  StudioPublishPage,
  StudioSeriesPage
} from './lazy-routes';

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
        <Suspense fallback={<div className="min-h-dvh bg-[#050506]" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

type AppRouter = ReturnType<typeof createBrowserRouter>;

function RouteLoadingScreen() {
  return <div className="min-h-dvh bg-[#050506]" />;
}

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoadingScreen />}>{element}</Suspense>;
}

export const router: AppRouter = createBrowserRouter([
  {
    path: '/v/:publishId',
    element: withRouteSuspense(<PromptoonViewerPage />)
  },
  {
    path: '/v/:publishId/:episodeNo',
    element: withRouteSuspense(<PromptoonViewerPage />)
  },
  {
    path: '/promptoon/projects/:projectId/episodes/:episodeId/test-viewer',
    element: (
      <ProtectedRoute requireStudio>
        {withRouteSuspense(<PromptoonViewerPage />)}
      </ProtectedRoute>
    )
  },
  {
    path: '/studio/projects/:projectId/episodes/:episodeId/test-viewer',
    element: (
      <ProtectedRoute requireStudio>
        {withRouteSuspense(<PromptoonViewerPage />)}
      </ProtectedRoute>
    )
  },
  {
    path: '/',
    element: withRouteSuspense(<ConsumerHomePage />)
  },
  {
    path: '/about',
    element: withRouteSuspense(<AboutPage />)
  },
  {
    path: '/discovery',
    element: withRouteSuspense(<FeedHomePage />)
  },
  {
    path: '/experimental',
    element: withRouteSuspense(<ConsumerExperimentalPage />)
  },
  {
    path: '/library',
    element: withRouteSuspense(<ConsumerLibraryPage />)
  },
  {
    path: '/my',
    element: withRouteSuspense(<ConsumerMyPage />)
  },
  {
    path: '/privacy',
    element: withRouteSuspense(<LegalDocumentPage />)
  },
  {
    path: '/terms',
    element: withRouteSuspense(<LegalDocumentPage />)
  },
  {
    path: '/feed',
    element: <Navigate replace to="/discovery" />
  },
  {
    path: '/shorts/:publishId',
    element: withRouteSuspense(<MovingtoonShortViewerPage />)
  },
  {
    path: '/channel/:channelId',
    element: withRouteSuspense(<ChannelPage />)
  },
  {
    path: '/overview',
    element: <Navigate replace to="/discovery" />
  },
  {
    path: '/c/:channelSlug',
    element: withRouteSuspense(<ChannelHomePage />)
  },
  {
    path: '/c/:channelSlug/series',
    element: withRouteSuspense(<ChannelHomePage />)
  },
  {
    path: '/c/:channelSlug/shorts',
    element: withRouteSuspense(<ChannelHomePage />)
  },
  {
    path: '/c/:channelSlug/promptoons',
    element: withRouteSuspense(<ChannelHomePage />)
  },
  {
    path: '/c/:channelSlug/community',
    element: withRouteSuspense(<ChannelHomePage />)
  },
  {
    path: '/login',
    element: withRouteSuspense(<LoginPage />)
  },
  {
    path: '/register',
    element: withRouteSuspense(<RegisterPage />)
  },
  {
    path: '/community/publishes/:publishId',
    element: withRouteSuspense(<CommunityDiscussionPage />)
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
