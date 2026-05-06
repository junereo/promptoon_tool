import type { AdminMeResponse, AuthResponse, AuthSession, AuthUser, PlatformRole, StudioRole } from '@promptoon/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SessionStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'denied';

interface AdminAuthState {
  token: string | null;
  user: AuthUser | null;
  session: AuthSession | null;
  studioRole: StudioRole | null;
  platformRole: PlatformRole | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  sessionStatus: SessionStatus;
  login: (payload: AuthResponse) => void;
  markSessionChecking: () => void;
  confirmAdminSession: (payload: AdminMeResponse) => void;
  markAccessDenied: () => void;
  logout: () => void;
  markHydrated: (hasHydrated: boolean) => void;
}

const initialState = {
  token: null,
  user: null,
  session: null,
  studioRole: null,
  platformRole: null,
  isAuthenticated: false,
  hasHydrated: false,
  sessionStatus: 'idle' as SessionStatus
};

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      ...initialState,
      login: ({ token, user, session }) =>
        set({
          token,
          user,
          session: session ?? null,
          studioRole: null,
          platformRole: null,
          isAuthenticated: true,
          sessionStatus: session ? 'valid' : 'idle'
        }),
      markSessionChecking: () => set({ sessionStatus: 'checking' }),
      confirmAdminSession: ({ user, session, studioRole, platformRole }) =>
        set({
          user,
          session,
          studioRole: studioRole ?? null,
          platformRole,
          isAuthenticated: true,
          sessionStatus: 'valid'
        }),
      markAccessDenied: () =>
        set({
          platformRole: null,
          sessionStatus: 'denied'
        }),
      logout: () =>
        set({
          token: null,
          user: null,
          session: null,
          studioRole: null,
          platformRole: null,
          isAuthenticated: false,
          sessionStatus: 'idle'
        }),
      markHydrated: (hasHydrated) => set({ hasHydrated })
    }),
    {
      name: 'promptoon_admin_auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to hydrate admin auth store', error);
        }

        state?.markHydrated(true);
      }
    }
  )
);
