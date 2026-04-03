import userEvent from '@testing-library/user-event';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../src/features/auth/store/use-auth-store';
import { LoginPage } from '../src/pages/LoginPage';
import { RegisterPage } from '../src/pages/RegisterPage';

const loginMutateAsync = vi.fn();
const registerMutateAsync = vi.fn();

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

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  loginMutateAsync.mockReset();
  registerMutateAsync.mockReset();
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    hasHydrated: true
  });
});

function renderPage(path: '/login' | '/register') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
});
