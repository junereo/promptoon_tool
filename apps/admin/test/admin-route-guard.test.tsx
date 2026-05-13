import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdminRouteGuard } from '../src/features/auth/AdminRouteGuard';
import { useAdminAuthStore } from '../src/features/auth/use-admin-auth-store';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  useAdminAuthStore.setState({
    token: null,
    user: null,
    session: null,
    studioRole: null,
    platformRole: null,
    isAuthenticated: false,
    hasHydrated: false,
    sessionStatus: 'idle'
  });
});

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>Admin Login</div>} />
        <Route
          path="/"
          element={
            <AdminRouteGuard>
              <div>Admin Console</div>
            </AdminRouteGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRouteGuard', () => {
  it('waits for hydration before redirecting', () => {
    renderGuard();

    expect(screen.getByText('관리자 세션을 확인하고 있습니다.')).toBeTruthy();
  });

  it('redirects unauthenticated users', async () => {
    useAdminAuthStore.setState({
      hasHydrated: true,
      isAuthenticated: false,
      sessionStatus: 'idle'
    });

    renderGuard();

    expect(await screen.findByText('Admin Login')).toBeTruthy();
  });

  it('requires platform admin role', () => {
    useAdminAuthStore.setState({
      token: 'token',
      user: { id: 'user-1', loginId: 'operator001' },
      session: {
        id: 'session-1',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString()
      },
      platformRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'denied'
    });

    renderGuard();

    expect(screen.getByText('Platform Admin 권한이 필요합니다.')).toBeTruthy();
  });

  it('allows platform admins', () => {
    useAdminAuthStore.setState({
      token: 'token',
      user: { id: 'user-1', loginId: 'operator001' },
      session: {
        id: 'session-1',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString()
      },
      platformRole: 'platform_admin',
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'valid'
    });

    renderGuard();

    expect(screen.getByText('Admin Console')).toBeTruthy();
  });
});
