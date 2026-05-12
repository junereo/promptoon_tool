import userEvent from '@testing-library/user-event';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../src/features/auth/store/use-auth-store';
import { LoginPage } from '../src/pages/LoginPage';
import { RegisterPage } from '../src/pages/RegisterPage';

const loginMutateAsync = vi.hoisted(() => vi.fn());
const registerMutateAsync = vi.hoisted(() => vi.fn());
const authRefreshMock = vi.hoisted(() => vi.fn());
const getGoogleAuthorizationUrlMock = vi.hoisted(() => vi.fn());
const authResponse = {
  token: 'test-token',
  session: {
    id: 'session-1',
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString()
  },
  user: {
    id: 'user-1',
    loginId: 'filoclo2026'
  }
};

vi.mock('../src/features/auth/hooks/use-auth-query', () => ({
  useLogin: () => ({
    isPending: false,
    mutateAsync: loginMutateAsync
  }),
  useRegister: () => ({
    isPending: false,
    mutateAsync: registerMutateAsync
  })
}));

vi.mock('../src/shared/api/auth.service', () => ({
  authService: {
    refresh: authRefreshMock,
    getGoogleAuthorizationUrl: getGoogleAuthorizationUrlMock
  }
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  loginMutateAsync.mockReset();
  registerMutateAsync.mockReset();
  authRefreshMock.mockReset();
  getGoogleAuthorizationUrlMock.mockReset();
  useAuthStore.setState({
    user: null,
    session: null,
    isAuthenticated: false,
    hasHydrated: true,
    sessionStatus: 'idle'
  });
});

function renderPage(path: '/login' | '/register') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>Consumer Home</div>} />
        <Route path="/promptoon/projects" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('auth pages', () => {
  it('validates login form input before submitting', async () => {
    const user = userEvent.setup();
    renderPage('/login');

    await user.type(screen.getByLabelText('아이디'), 'short');
    await user.type(screen.getByLabelText('비밀번호'), 'tiny');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('아이디는 최소 8자 이상이어야 합니다.')).toBeTruthy();
    expect(loginMutateAsync).not.toHaveBeenCalled();
  });

  it('validates register form input before submitting', async () => {
    const user = userEvent.setup();
    renderPage('/register');

    await user.type(screen.getByLabelText('아이디'), 'short');
    await user.type(screen.getByLabelText('비밀번호'), 'tiny');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('아이디는 최소 8자 이상이어야 합니다.')).toBeTruthy();
    expect(registerMutateAsync).not.toHaveBeenCalled();
  });

  it('routes to home after login instead of projects', async () => {
    const user = userEvent.setup();
    loginMutateAsync.mockResolvedValue(authResponse);
    renderPage('/login');

    await user.type(screen.getByLabelText('아이디'), 'filoclo2026');
    await user.type(screen.getByLabelText('비밀번호'), 'password2026');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Consumer Home')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('starts Google login from the login page', async () => {
    const user = userEvent.setup();
    getGoogleAuthorizationUrlMock.mockRejectedValue(new Error('blocked'));
    renderPage('/login');

    await user.click(screen.getByRole('button', { name: 'Google로 로그인' }));

    expect(getGoogleAuthorizationUrlMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Google 로그인을 시작할 수 없습니다.')).toBeTruthy();
  });

  it('routes to home after register instead of projects', async () => {
    const user = userEvent.setup();
    registerMutateAsync.mockResolvedValue(authResponse);
    renderPage('/register');

    await user.type(screen.getByLabelText('아이디'), 'newuser2026');
    await user.type(screen.getByLabelText('비밀번호'), 'password2026');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Consumer Home')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });
});
