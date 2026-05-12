import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AdminRouteGuard } from '../features/auth/AdminRouteGuard';
import { AdminLayout } from '../pages/AdminLayout';
import { CommunityPage, DashboardPage, ExperimentalPage, ProjectsPage, PublishesPage, TelemetryPage, UsersPage } from '../pages/AdminPages';
import { LoginPage } from '../pages/LoginPage';

type AdminRouter = ReturnType<typeof createBrowserRouter>;

export const router: AdminRouter = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/',
    element: (
      <AdminRouteGuard>
        <AdminLayout />
      </AdminRouteGuard>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: 'users',
        element: <UsersPage />
      },
      {
        path: 'projects',
        element: <ProjectsPage />
      },
      {
        path: 'publishes',
        element: <PublishesPage />
      },
      {
        path: 'experimental',
        element: <ExperimentalPage />
      },
      {
        path: 'community',
        element: <CommunityPage />
      },
      {
        path: 'telemetry',
        element: <TelemetryPage />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate replace to="/" />
  }
]);
