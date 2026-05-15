import {
  ChartBarVertical01 as BarChart3,
  FileDocument as FileText,
  House01 as Home,
  Image01 as Image,
  LogOut,
  Chat as MessageSquare,
  PaperPlane as Rocket,
  Lock as Key,
  ShieldCheck,
  Users
} from 'react-coolicons';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { queryClient } from '../app/query-client';
import { clearAdminAuthSession } from '../features/auth/auth-session';
import { useAdminAuthStore } from '../features/auth/use-admin-auth-store';
import { authApi } from '../shared/api/auth.api';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/projects', label: 'Projects', icon: FileText },
  { to: '/publishes', label: 'Publishes', icon: Rocket },
  { to: '/experimental', label: 'Experimental', icon: ShieldCheck },
  { to: '/platform-access', label: 'Platform Access', icon: Key },
  { to: '/landing', label: '대문 관리', icon: Image },
  { to: '/community', label: 'Community', icon: MessageSquare },
  { to: '/telemetry', label: 'Telemetry', icon: BarChart3 }
];

export function AdminLayout() {
  const navigate = useNavigate();
  const user = useAdminAuthStore((state) => state.user);
  const platformRole = useAdminAuthStore((state) => state.platformRole);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      clearAdminAuthSession();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-b border-admin-border bg-white/85 px-5 py-5 shadow-sm backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.26em] text-admin-blue">Promptoon</p>
          <h1 className="mt-2 text-2xl font-black text-admin-ink">Platform Admin</h1>
          <p className="mt-2 text-sm text-admin-muted">{user?.loginId ?? 'unknown'} · {platformRole ?? 'no role'}</p>
        </div>

        <nav className="mt-8 grid gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition',
                    isActive ? 'bg-admin-blue text-white shadow-lg shadow-blue-500/20' : 'text-admin-muted hover:bg-blue-50 hover:text-admin-ink'
                  ].join(' ')
                }
                end={item.to === '/'}
                key={item.to}
                to={item.to}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <button
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-admin-border bg-white px-4 py-3 text-sm font-bold text-admin-muted transition hover:border-admin-blue hover:text-admin-blue"
          onClick={handleLogout}
          type="button"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      <main className="min-w-0 px-5 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
