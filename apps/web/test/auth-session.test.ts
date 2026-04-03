import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleUnauthorizedResponse } from '../src/features/auth/lib/auth-session';
import { useAuthStore } from '../src/features/auth/store/use-auth-store';

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({
    token: 'token-1',
    user: { id: 'user-1', loginId: 'creator001' },
    isAuthenticated: true,
    hasHydrated: true
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleUnauthorizedResponse', () => {
  it('clears the auth session and redirects to login from protected screens', () => {
    window.history.pushState({}, '', '/promptoon/projects');
    const redirect = vi.fn();

    handleUnauthorizedResponse(redirect);

    expect(useAuthStore.getState().token).toBeNull();
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
