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
    isAuthenticated: false,
    hasHydrated: false
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
      isAuthenticated: false,
      hasHydrated: true
    });

    renderProtectedRoute();
    expect(await screen.findByText('Login Screen')).toBeTruthy();

    cleanup();

    useAuthStore.setState({
      token: 'token-1',
      user: { id: 'user-1', loginId: 'creator001' },
      isAuthenticated: true,
      hasHydrated: true
    });

    renderProtectedRoute();
    expect(screen.getByText('Protected Dashboard')).toBeTruthy();
  });
});
