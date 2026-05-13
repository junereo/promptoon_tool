import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionBootstrap } from '../src/features/auth/components/AuthSessionBootstrap';
import { clearCookieSessionHint, markCookieSessionHint } from '../src/features/auth/lib/auth-storage';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

const meMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock('../src/shared/api/auth.api', () => ({
  authApi: {
    me: meMock,
    refresh: refreshMock
  }
}));

afterEach(() => {
  cleanup();
  clearCookieSessionHint();
});

beforeEach(() => {
  window.localStorage.clear();
  clearCookieSessionHint();
  meMock.mockReset();
  refreshMock.mockReset();
  refreshMock.mockRejectedValue(new Error('no refresh session'));
  useAuthStore.setState({
    user: null,
    session: null,
    studioRole: null,
    isAuthenticated: false,
    hasHydrated: false,
    sessionStatus: 'idle'
  });
});

describe('AuthSessionBootstrap', () => {
  it('validates a memory-backed cookie session once and confirms the active session', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600).toISOString()
    };
    meMock.mockResolvedValue({
      user: { id: 'user-1', loginId: 'creator001' },
      studioRole: 'studio_admin',
      session
    });
    useAuthStore.setState({
      user: { id: 'user-1', loginId: 'creator001' },
      session: null,
      studioRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'idle'
    });

    render(<AuthSessionBootstrap><div>App</div></AuthSessionBootstrap>);

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().session?.id).toBe('session-1');
      expect(useAuthStore.getState().studioRole).toBe('studio_admin');
      expect(useAuthStore.getState().sessionStatus).toBe('valid');
    });
  });

  it('refreshes a cookie-backed session before validating the active session', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600).toISOString()
    };
    refreshMock.mockResolvedValue({
      token: 'access-token-from-refresh',
      user: { id: 'user-1', loginId: 'creator001' },
      session
    });
    meMock.mockResolvedValue({
      user: { id: 'user-1', loginId: 'creator001' },
      studioRole: 'studio_admin',
      session
    });
    useAuthStore.setState({
      user: null,
      session: null,
      studioRole: null,
      isAuthenticated: false,
      hasHydrated: true,
      sessionStatus: 'idle'
    });
    markCookieSessionHint();

    render(<AuthSessionBootstrap><div>App</div></AuthSessionBootstrap>);

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(meMock).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem('promptoon_auth')).toBeNull();
      expect(window.localStorage.getItem('promptoon_auth_session')).toBe('1');
      expect(useAuthStore.getState().sessionStatus).toBe('valid');
    });
  });

  it('refreshes when only the API-set session hint cookie exists', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600).toISOString()
    };
    refreshMock.mockResolvedValue({
      token: 'access-token-from-refresh',
      user: { id: 'user-1', loginId: 'creator001' },
      session
    });
    meMock.mockResolvedValue({
      user: { id: 'user-1', loginId: 'creator001' },
      studioRole: 'studio_admin',
      session
    });
    useAuthStore.setState({
      user: null,
      session: null,
      studioRole: null,
      isAuthenticated: false,
      hasHydrated: true,
      sessionStatus: 'idle'
    });
    document.cookie = 'pt_auth_session=1; Path=/; Max-Age=2592000; SameSite=Lax';

    render(<AuthSessionBootstrap><div>App</div></AuthSessionBootstrap>);

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(meMock).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().sessionStatus).toBe('valid');
    });
  });

  it('does not call refresh when no cookie session hint exists', async () => {
    useAuthStore.setState({
      user: null,
      session: null,
      studioRole: null,
      isAuthenticated: false,
      hasHydrated: true,
      sessionStatus: 'idle'
    });

    render(<AuthSessionBootstrap><div>App</div></AuthSessionBootstrap>);

    await waitFor(() => {
      expect(refreshMock).not.toHaveBeenCalled();
      expect(meMock).not.toHaveBeenCalled();
      expect(useAuthStore.getState().sessionStatus).toBe('invalid');
    });
  });

  it('clears auth when cookie session validation fails', async () => {
    window.history.pushState({}, '', '/login');
    meMock.mockRejectedValue(new Error('unauthorized'));
    useAuthStore.setState({
      user: { id: 'user-1', loginId: 'creator001' },
      session: null,
      studioRole: null,
      isAuthenticated: true,
      hasHydrated: true,
      sessionStatus: 'idle'
    });

    render(<AuthSessionBootstrap><div>App</div></AuthSessionBootstrap>);

    await waitFor(() => {
      expect(meMock).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(window.localStorage.getItem('promptoon_auth')).toBeNull();
    });
  });
});
