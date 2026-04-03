import type { AuthResponse, AuthUser } from '@promptoon/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (payload: AuthResponse) => void;
  logout: () => void;
  markHydrated: (hasHydrated: boolean) => void;
}

const initialState = {
  token: null,
  user: null,
  isAuthenticated: false,
  hasHydrated: false
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      login: ({ token, user }) =>
        set({
          token,
          user,
          isAuthenticated: true
        }),
      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false
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
