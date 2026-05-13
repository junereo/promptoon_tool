import userEvent from '@testing-library/user-event';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAdminAuthStore } from '../src/features/auth/use-admin-auth-store';
import { LoginPage } from '../src/pages/LoginPage';

const getGoogleAuthorizationUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../src/shared/api/auth.api', () => ({
  authApi: {
    getGoogleAuthorizationUrl: getGoogleAuthorizationUrlMock,
    login: vi.fn(),
    refresh: vi.fn()
  }
}));

vi.mock('../src/shared/api/admin.api', () => ({
  adminApi: {
    me: vi.fn()
  }
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  getGoogleAuthorizationUrlMock.mockReset();
  useAdminAuthStore.setState({
    token: null,
    user: null,
    session: null,
    studioRole: null,
    platformRole: null,
    isAuthenticated: false,
    hasHydrated: true,
    sessionStatus: 'idle'
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Admin Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Admin LoginPage', () => {
  it('starts Google admin login with the admin state', async () => {
    const user = userEvent.setup();
    getGoogleAuthorizationUrlMock.mockRejectedValue(new Error('blocked'));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Google로 관리자 로그인' }));

    expect(getGoogleAuthorizationUrlMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Google 로그인을 시작할 수 없습니다.')).toBeTruthy();
  });
});
