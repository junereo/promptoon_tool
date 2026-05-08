import { Suspense, lazy, useState, type ComponentType } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import { clearAuthSession } from '../features/auth/lib/auth-session';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { preloadPromptoonViewerPage } from '../features/viewer/lib/preload-viewer';

function lazyNamedPage<TModule extends Record<string, ComponentType>, TExport extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TExport
) {
  return lazy(async () => ({
    default: (await loader())[exportName]
  }));
}

const ChannelHomePage = lazyNamedPage(
  () => import('../domains/channel/pages/ChannelHomePage'),
  'ChannelHomePage'
);
const ChannelPage = lazyNamedPage(() => import('../domains/channel/pages/ChannelPage'), 'ChannelPage');
const CommunityDiscussionPage = lazyNamedPage(
  () => import('../domains/community/pages/CommunityDiscussionPage'),
  'CommunityDiscussionPage'
);
const ConsumerHomePage = lazyNamedPage(() => import('../domains/consumer/pages/ConsumerHomePage'), 'ConsumerHomePage');
const ConsumerLibraryPage = lazyNamedPage(
  () => import('../domains/consumer/pages/ConsumerLibraryPage'),
  'ConsumerLibraryPage'
);
const ConsumerMyPage = lazyNamedPage(() => import('../domains/consumer/pages/ConsumerMyPage'), 'ConsumerMyPage');
const FeedHomePage = lazyNamedPage(() => import('../domains/feed/pages/FeedHomePage'), 'FeedHomePage');
const MovingtoonShortViewerPage = lazyNamedPage(
  () => import('../domains/feed/pages/MovingtoonShortViewerPage'),
  'MovingtoonShortViewerPage'
);
const LoginPage = lazyNamedPage(() => import('../pages/LoginPage'), 'LoginPage');
const RegisterPage = lazyNamedPage(() => import('../pages/RegisterPage'), 'RegisterPage');
const StudioAssetLibraryPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioAssetLibraryPage'),
  'StudioAssetLibraryPage'
);
const StudioAnalyticsPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioAnalyticsPage'),
  'StudioAnalyticsPage'
);
const StudioCommunityModerationPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioCommunityModerationPage'),
  'StudioCommunityModerationPage'
);
const StudioEpisodeEditorPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioEpisodeEditorPage'),
  'StudioEpisodeEditorPage'
);
const StudioProjectDashboardPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioProjectDashboardPage'),
  'StudioProjectDashboardPage'
);
const StudioProjectDetailPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioProjectDetailPage'),
  'StudioProjectDetailPage'
);
const StudioProjectMembersPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioProjectMembersPage'),
  'StudioProjectMembersPage'
);
const StudioProjectSettingsPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioProjectSettingsPage'),
  'StudioProjectSettingsPage'
);
const StudioPublishHistoryPage = lazyNamedPage(
  () => import('../domains/studio/pages/StudioPublishHistoryPage'),
  'StudioPublishHistoryPage'
);
const StudioPublishPage = lazyNamedPage(() => import('../domains/studio/pages/StudioPublishPage'), 'StudioPublishPage');
const StudioSeriesPage = lazyNamedPage(() => import('../domains/studio/pages/StudioSeriesPage'), 'StudioSeriesPage');

const PromptoonViewerPage = lazy(() =>
  preloadPromptoonViewerPage().then((module) => ({ default: module.PromptoonViewerPage }))
);

function RouteLoadingScreen() {
  return <div className="min-h-dvh bg-[#050506]" />;
}

function ViewerRoute() {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <PromptoonViewerPage />
    </Suspense>
  );
}

function StudioTestViewerRoute() {
  return (
    <ProtectedRoute requireStudio>
      <ViewerRoute />
    </ProtectedRoute>
  );
}

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
        <Suspense fallback={<RouteLoadingScreen />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

function StudioRoutes() {
  return (
    <Route
      element={
        <ProtectedRoute requireStudio>
          <AppShell />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate replace to="projects" />} />
      <Route path="community/publishes/:publishId" element={<StudioCommunityModerationPage />} />
      <Route path="projects" element={<StudioProjectDashboardPage />} />
      <Route path="projects/:projectId" element={<StudioProjectDetailPage />} />
      <Route path="projects/:projectId/series" element={<StudioSeriesPage />} />
      <Route path="projects/:projectId/settings" element={<StudioProjectSettingsPage />} />
      <Route path="projects/:projectId/assets" element={<StudioAssetLibraryPage />} />
      <Route path="projects/:projectId/history" element={<StudioPublishHistoryPage />} />
      <Route path="projects/:projectId/members" element={<StudioProjectMembersPage />} />
      <Route path="projects/:projectId/publish" element={<StudioPublishPage />} />
      <Route path="projects/:projectId/analytics" element={<StudioAnalyticsPage />} />
      <Route path="projects/:projectId/episodes/:episodeId" element={<StudioEpisodeEditorPage />} />
    </Route>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route path="/" element={<ConsumerHomePage />} />
        <Route path="/discovery" element={<FeedHomePage />} />
        <Route path="/library" element={<ConsumerLibraryPage />} />
        <Route path="/my" element={<ConsumerMyPage />} />
        <Route path="/feed" element={<Navigate replace to="/discovery" />} />
        <Route path="/shorts/:publishId" element={<MovingtoonShortViewerPage />} />
        <Route path="/channel/:channelId" element={<ChannelPage />} />
        <Route path="/overview" element={<Navigate replace to="/discovery" />} />
        <Route path="/v/:publishId" element={<ViewerRoute />} />
        <Route path="/v/:publishId/:episodeNo" element={<ViewerRoute />} />
        <Route path="/promptoon/projects/:projectId/episodes/:episodeId/test-viewer" element={<StudioTestViewerRoute />} />
        <Route path="/studio/projects/:projectId/episodes/:episodeId/test-viewer" element={<StudioTestViewerRoute />} />
        <Route path="/c/:channelSlug" element={<ChannelHomePage />} />
        <Route path="/c/:channelSlug/series" element={<ChannelHomePage />} />
        <Route path="/c/:channelSlug/shorts" element={<ChannelHomePage />} />
        <Route path="/c/:channelSlug/promptoons" element={<ChannelHomePage />} />
        <Route path="/c/:channelSlug/community" element={<ChannelHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/community/publishes/:publishId" element={<CommunityDiscussionPage />} />

        <Route path="/promptoon">
          {StudioRoutes()}
        </Route>

        <Route path="/studio">
          {StudioRoutes()}
          <Route
            element={
              <ProtectedRoute requireStudio>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="episodes/:episodeId/editor" element={<StudioEpisodeEditorPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Suspense>
  );
}
