import type { AuthResponse, AuthSession, AuthUser, StudioRole } from '@promptoon/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SessionStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  session: AuthSession | null;
  studioRole: StudioRole | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  sessionStatus: SessionStatus;
  login: (payload: AuthResponse) => void;
  markSessionChecking: () => void;
  confirmSession: (payload: { user: AuthUser; session: AuthSession; studioRole?: StudioRole | null }) => void;
  logout: () => void;
  markHydrated: (hasHydrated: boolean) => void;
}

const initialState = {
  token: null,
  user: null,
  session: null,
  studioRole: null,
  isAuthenticated: false,
  hasHydrated: false,
  sessionStatus: 'idle' as SessionStatus
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      login: ({ token, user }) =>
        set({
          token,
          user,
          session: null,
          studioRole: null,
          isAuthenticated: true,
          sessionStatus: 'idle'
        }),
      markSessionChecking: () => set({ sessionStatus: 'checking' }),
      confirmSession: ({ user, session, studioRole }) =>
        set({
          user,
          session,
          studioRole: studioRole ?? null,
          isAuthenticated: true,
          sessionStatus: 'valid'
        }),
      logout: () =>
        set({
          token: null,
          user: null,
          session: null,
          studioRole: null,
          isAuthenticated: false,
          sessionStatus: 'idle'
        }),
      markHydrated: (hasHydrated) => set({ hasHydrated })
    }),
    {
      name: 'promptoon_auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to hydrate auth store', error);
        }

        state?.markHydrated(true);
      }
    }
  )
);
