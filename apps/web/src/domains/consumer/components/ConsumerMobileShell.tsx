import type { ReactNode } from 'react';

import { ConsumerBottomNav } from './ConsumerBottomNav';

export function ConsumerMobileShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#050506] text-white">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-[#09090b] pb-24 shadow-[0_0_80px_rgba(0,0,0,0.42)]">
        {children}
      </div>
      <ConsumerBottomNav />
    </main>
  );
}
