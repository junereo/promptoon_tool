import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProtectedRoute } from '../src/features/auth/components/ProtectedRoute';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({
    token: null,
    user: null,
    session: null,
    studioRole: null,
    isAuthenticated: false,
    hasHydrated: false,
    sessionStatus: 'idle'
  });
});

function renderProtectedRoute(initialEntry = '/promptoon/projects') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login Screen</div>} />
        <Route
          path="/promptoon/projects"
          element={
            <ProtectedRoute>
              <div>Protected Dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function renderStudioProtectedRoute(initialEntry = '/studio/projects') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login Screen</div>} />
        <Route
          path="/studio/projects"
          element={
            <ProtectedRoute requireStudio>
              <div>Studio Dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('waits for hydration before redirecting', () => {
    renderProtectedRoute();

    expect(screen.getByText('인증 상태를 확인하고 있습니다.')).toBeTruthy();
    expect(screen.queryByText('Login Screen')).toBeNull();
  });

  it('redirects unauthenticated users after hydration and allows authenticated users', async () => {
    useAuthStore.setState({
      token: null,
      user: null,
      session: null,
      studioRole: null,
      isAuthenticated: false,
      hasHydrated: true,
      sessionStatus: 'idle'
    });

    renderProtectedRoute();
    expect(await screen.findByText('Login Screen')).toBeTruthy();

    cleanup();

    useAuthStore.setState({
      token: 'token-1',
      user: { id: 'user-1', loginId: 'creator001' },
      session: {
        id: 'session-1',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600).toISOString()
      },
      studioRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'valid'
    });

    renderProtectedRoute();
    expect(screen.getByText('Protected Dashboard')).toBeTruthy();
  });

  it('waits for persisted token session validation before allowing protected routes', () => {
    useAuthStore.setState({
      token: 'token-1',
      user: { id: 'user-1', loginId: 'creator001' },
      session: null,
      studioRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'idle'
    });

    renderProtectedRoute();

    expect(screen.getByText('인증 상태를 확인하고 있습니다.')).toBeTruthy();
    expect(screen.queryByText('Protected Dashboard')).toBeNull();
  });

  it('requires a Studio role when a route opts into Studio access', () => {
    useAuthStore.setState({
      token: 'token-1',
      user: { id: 'user-1', loginId: 'creator001' },
      session: {
        id: 'session-1',
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600).toISOString()
      },
      studioRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'valid'
    });

    renderStudioProtectedRoute();
    expect(screen.getByText('Studio 권한이 필요합니다.')).toBeTruthy();

    cleanup();

    useAuthStore.setState({
      studioRole: 'producer'
    });

    renderStudioProtectedRoute();
    expect(screen.getByText('Studio Dashboard')).toBeTruthy();
  });
});
