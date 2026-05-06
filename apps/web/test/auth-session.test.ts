import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleUnauthorizedResponse } from '../src/features/auth/lib/auth-session';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({
    token: 'token-1',
    user: { id: 'user-1', loginId: 'creator001' },
    session: {
      id: 'session-1',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600).toISOString()
    },
    isAuthenticated: true,
    hasHydrated: true,
    sessionStatus: 'valid'
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleUnauthorizedResponse', () => {
  it('marks a fresh login for session validation so Studio role is loaded before protected routes render', () => {
    useAuthStore.getState().login({
      token: 'fresh-token',
      user: { id: 'user-2', loginId: 'creator002' },
      session: {
        id: 'session-2',
        userId: 'user-2',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600).toISOString()
      }
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().sessionStatus).toBe('idle');
    expect(useAuthStore.getState().studioRole).toBeNull();
  });

  it('clears the auth session and redirects to login from protected screens', () => {
    window.history.pushState({}, '', '/promptoon/projects');
    const redirect = vi.fn();

    handleUnauthorizedResponse(redirect);

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('clears the auth session without redirecting when already on an auth screen', () => {
    window.history.pushState({}, '', '/login');
    const redirect = vi.fn();

    handleUnauthorizedResponse(redirect);

    expect(useAuthStore.getState().token).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});
