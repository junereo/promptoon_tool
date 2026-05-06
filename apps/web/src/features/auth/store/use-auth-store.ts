import type { AuthResponse, AuthSession, AuthUser, StudioRole } from '@promptoon/shared';
import { create } from 'zustand';

import { clearCookieSessionHint, clearLegacyAuthStorage, markCookieSessionHint } from '../lib/auth-storage';

type SessionStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  studioRole: StudioRole | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  sessionStatus: SessionStatus;
  login: (payload: AuthResponse) => void;
  markSessionChecking: () => void;
  markSessionInvalid: () => void;
  confirmSession: (payload: { user: AuthUser; session: AuthSession; studioRole?: StudioRole | null }) => void;
  logout: () => void;
  markHydrated: (hasHydrated: boolean) => void;
}

clearLegacyAuthStorage();

const initialState = {
  user: null,
  session: null,
  studioRole: null,
  isAuthenticated: false,
  hasHydrated: true,
  sessionStatus: 'idle' as SessionStatus
};

export const useAuthStore = create<AuthState>()((set) => ({
  ...initialState,
  login: ({ user, session }: AuthResponse) => {
    markCookieSessionHint();
    set({
      user,
      session: session ?? null,
      studioRole: null,
      isAuthenticated: true,
      sessionStatus: 'idle'
    });
  },
  markSessionChecking: () => set({ sessionStatus: 'checking' }),
  markSessionInvalid: () => set({ sessionStatus: 'invalid' }),
  confirmSession: ({ user, session, studioRole }) => {
    markCookieSessionHint();
    set({
      user,
      session,
      studioRole: studioRole ?? null,
      isAuthenticated: true,
      sessionStatus: 'valid'
    });
  },
  logout: () => {
    clearLegacyAuthStorage();
    clearCookieSessionHint();
    set({
      user: null,
      session: null,
      studioRole: null,
      isAuthenticated: false,
      sessionStatus: 'idle'
    });
  },
  markHydrated: (hasHydrated) => set({ hasHydrated })
}));
