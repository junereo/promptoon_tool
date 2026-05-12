import type { ComponentType, SVGProps } from 'react';
import { BookOpen, Compass, House01 as Home, User01 as User } from 'react-coolicons';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '../../../shared/lib/cn';

interface ConsumerNavItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  to: string;
}

const CONSUMER_NAV_ITEMS: ConsumerNavItem[] = [
  { icon: Home, label: '홈', to: '/' },
  { icon: Compass, label: '탐색', to: '/discovery' },
  { icon: BookOpen, label: '보관함', to: '/library' },
  { icon: User, label: '마이', to: '/my' }
];

interface ConsumerBottomNavProps {
  className?: string;
  containerClassName?: string;
}

export function ConsumerBottomNav({ className, containerClassName }: ConsumerBottomNavProps = {}) {
  const location = useLocation();

  return (
    <nav className={cn('fixed inset-x-0 bottom-0 z-50 text-white', className)} aria-label="주요 메뉴">
      <div
        className={cn(
          'mx-auto w-full max-w-[480px] border-t border-white/10 bg-[#09090b]/92 px-3 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-2 shadow-[0_-16px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl',
          containerClassName
        )}
      >
        <div className="grid grid-cols-4 gap-1">
          {CONSUMER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition',
                  isActive ? 'text-white' : 'text-white/52 hover:text-white/82'
                )}
                key={item.to}
                to={item.to}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full transition',
                    isActive ? 'bg-white text-zinc-950' : 'text-current'
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
