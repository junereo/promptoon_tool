import type { ComponentType, SVGProps } from 'react';
import { BookOpen, Compass, House01 as Home, User01 as User } from 'react-coolicons';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';

interface BottomNavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: '홈', to: '/', icon: Home },
  { label: '탐색', to: '/discovery', icon: Compass },
  { label: '보관함', to: '/library', icon: BookOpen },
  { label: '마이', to: '/my', icon: User }
];

function getUserInitial(loginId: string | null | undefined) {
  return loginId?.trim().slice(0, 1).toUpperCase() || 'MY';
}

export function FeedBottomNav({
  className,
  containerClassName,
  isAuthenticated = false,
  isVisible = false,
  userLoginId
}: {
  className?: string;
  containerClassName?: string;
  isAuthenticated?: boolean;
  isVisible?: boolean;
  userLoginId?: string | null;
}) {
  const location = useLocation();
  const userInitial = getUserInitial(userLoginId);

  return (
    <nav
      aria-hidden={!isVisible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 text-white transition-transform duration-200 ease-out',
        isVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto w-full max-w-[480px] border-t border-white/10 bg-black/55 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl',
          containerClassName
        )}
      >
        <div className="grid w-full grid-cols-4 items-end gap-1">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const to = item.to;
            const isActive = location.pathname === to;

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
                    'h-8 w-8',
                    isActive ? 'bg-white/15 text-white' : ''
                  ].join(' ')}
                >
                  {item.label === '마이' && isAuthenticated ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-zinc-950">
                      {userInitial}
                    </span>
                  ) : (
                    <Icon aria-hidden className="h-4 w-4" />
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
