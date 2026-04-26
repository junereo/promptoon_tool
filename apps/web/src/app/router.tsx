import { Suspense, lazy } from 'react';
import { Link, Outlet, createBrowserRouter, useNavigate } from 'react-router-dom';

import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import { clearAuthSession } from '../features/auth/lib/auth-session';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { preloadPromptoonViewerPage } from '../features/viewer/lib/preload-viewer';
import { LoginPage } from '../pages/LoginPage';
import { MainFeedPage } from '../pages/MainFeedPage';
import { PromptoonEpisodeEditorPage } from '../pages/promptoon-episode-editor-page';
import { PromptoonProjectListPage } from '../pages/promptoon-project-list-page';
import { RegisterPage } from '../pages/RegisterPage';

const PromptoonViewerPage = lazy(() =>
  preloadPromptoonViewerPage().then((module) => ({ default: module.PromptoonViewerPage }))
);

function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  function handleLogout() {
    clearAuthSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-editor-border/80 bg-black/20 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="font-display text-xl font-semibold tracking-tight text-zinc-50">Promptoon Authoring</p>
            <p className="text-sm text-zinc-400">State-first interactive episode editor</p>
          </div>

          <div className="flex items-center gap-3">
            <p className="rounded-full border border-editor-border bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
              {user?.loginId ?? 'anonymous'}
            </p>
            <Link className="text-sm text-zinc-400 transition hover:text-zinc-200" to="/promptoon/projects">
              Home
            </Link>
            <button
              className="rounded-full border border-editor-border bg-black/20 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              onClick={handleLogout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <Outlet />
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
    path: '/',
    element: <MainFeedPage />
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
    path: '/promptoon',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'projects',
        element: <PromptoonProjectListPage />
      },
      {
        path: 'projects/:projectId/episodes/:episodeId',
        element: <PromptoonEpisodeEditorPage />
      }
    ]
  }
]);
