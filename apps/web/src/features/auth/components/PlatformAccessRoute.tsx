import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { platformAccessApi } from '../../../shared/api/platform-access.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { ConsumerResponsiveFrame } from '../../../domains/consumer/components/ConsumerResponsiveFrame';
import { useAuthStore } from '../store/use-auth-store';

function PlatformAccessLoadingScreen() {
  return (
    <ConsumerResponsiveFrame>
      <div className="flex min-h-dvh items-center justify-center px-5 text-center text-sm text-white/58">
        플랫폼 접근 권한을 확인하고 있습니다.
      </div>
    </ConsumerResponsiveFrame>
  );
}

function PlatformAccessDeniedScreen() {
  return (
    <ConsumerResponsiveFrame>
      <section className="flex min-h-dvh flex-col justify-center px-6 py-12 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1fffe6]/72">Promptoon Platform</p>
        <h1 className="mt-4 font-display text-3xl font-black leading-tight tracking-normal text-white">
          플랫폼 진입 권한이 필요합니다.
        </h1>
        <p className="mt-5 text-sm leading-6 text-white/62">
          데모 대문 마지막 화면에서 특별 코드를 입력한 계정만 플랫폼 홈에 접근할 수 있습니다.
        </p>
        <Navigate replace to="/?gate=1" />
      </section>
    </ConsumerResponsiveFrame>
  );
}

export function PlatformAccessRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const accessQuery = useQuery({
    enabled: hasHydrated && isAuthenticated,
    queryKey: promptoonKeys.platformAccess(),
    queryFn: platformAccessApi.getMyAccess
  });

  if (!hasHydrated || sessionStatus === 'checking') {
    return <PlatformAccessLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (accessQuery.isLoading || accessQuery.isFetching) {
    return <PlatformAccessLoadingScreen />;
  }

  if (!accessQuery.data?.hasAccess) {
    return <PlatformAccessDeniedScreen />;
  }

  return <>{children}</>;
}
