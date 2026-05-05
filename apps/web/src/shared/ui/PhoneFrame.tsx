import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

type PhoneFrameProps = {
  children: ReactNode;
  className?: string;
};

export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        'mx-auto rounded-[2.4rem] bg-slate-950 p-2 shadow-pt-phone ring-1 ring-slate-900/10',
        className
      )}
    >
      <div className="overflow-hidden rounded-[1.9rem] bg-white">{children}</div>
    </div>
  );
}
