import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionBootstrap } from '../src/features/auth/components/AuthSessionBootstrap';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

const meMock = vi.hoisted(() => vi.fn());

vi.mock('../src/shared/api/auth.api', () => ({
  authApi: {
    me: meMock
  }
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  meMock.mockReset();
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

describe('AuthSessionBootstrap', () => {
  it('validates a persisted token once and confirms the active session', async () => {
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
      token: 'token-1',
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

  it('clears auth when persisted token validation fails', async () => {
    window.history.pushState({}, '', '/login');
    meMock.mockRejectedValue(new Error('unauthorized'));
    useAuthStore.setState({
      token: 'token-1',
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
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
