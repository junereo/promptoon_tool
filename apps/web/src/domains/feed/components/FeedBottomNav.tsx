import type { ComponentType, SVGProps } from 'react';
import { Bell, Compass, House01 as Home, AddPlus as Plus, User01 as User } from 'react-coolicons';
import { Link, useLocation } from 'react-router-dom';

interface BottomNavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  prominent?: boolean;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: '홈', to: '/feed', icon: Home },
  { label: '탐색', to: '/overview', icon: Compass },
  { label: '만들기', to: '/promptoon/projects', icon: Plus, prominent: true },
  { label: '알림', to: '/feed', icon: Bell },
  { label: 'MY', to: '/login', icon: User }
];

function getUserInitial(loginId: string | null | undefined) {
  return loginId?.trim().slice(0, 1).toUpperCase() || 'MY';
}

export function FeedBottomNav({
  isAuthenticated = false,
  isVisible = false,
  userLoginId
}: {
  isAuthenticated?: boolean;
  isVisible?: boolean;
  userLoginId?: string | null;
}) {
  const location = useLocation();
  const userInitial = getUserInitial(userLoginId);

  return (
    <nav
      aria-hidden={!isVisible}
      className={[
        'fixed inset-x-0 bottom-0 z-40 text-white transition-transform duration-200 ease-out',
        isVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      ].join(' ')}
    >
      <div className="mx-auto w-[min(100vw,calc(100dvh*9/16))] border-t border-white/10 bg-black/55 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl">
        <div className="grid w-full grid-cols-5 items-end gap-1">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const to = item.label === 'MY' && isAuthenticated ? '/promptoon/projects' : item.to;
            const isActive = location.pathname === to || (to === '/feed' && location.pathname === '/');

            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className="flex min-w-0 flex-col items-center gap-1 text-[11px] font-medium text-white/70 transition hover:text-white"
                key={`${item.label}-${item.to}`}
                to={to}
              >
                <span
                  className={[
                    'flex items-center justify-center rounded-full transition',
                    item.prominent
                      ? 'h-11 w-11 bg-white text-zinc-950 shadow-lg shadow-black/30'
                      : 'h-8 w-8',
                    isActive && !item.prominent ? 'bg-white/15 text-white' : ''
                  ].join(' ')}
                >
                  {item.label === 'MY' && isAuthenticated ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-zinc-950">
                      {userInitial}
                    </span>
                  ) : (
                    <Icon aria-hidden className={item.prominent ? 'h-5 w-5' : 'h-4 w-4'} />
                  )}
                </span>
                <span className={item.prominent ? 'text-white' : undefined}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
