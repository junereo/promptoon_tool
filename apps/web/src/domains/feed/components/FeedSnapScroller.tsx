import type { ReactNode } from 'react';

export function FeedSnapScroller({ children }: { children: ReactNode }) {
  return <div className="scrollbar-hidden h-dvh overflow-y-auto snap-y snap-mandatory">{children}</div>;
}
