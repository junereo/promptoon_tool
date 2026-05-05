export interface AuthSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthMeResponse {
  user: import('./legacy').AuthUser;
  studioRole?: import('./studio').StudioRole | null;
  session: AuthSession;
}

export type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from './legacy';
