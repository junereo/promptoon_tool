import type { ReactNode } from 'react';

type StageCardProps = {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function StageCard({ step, title, subtitle, children }: StageCardProps) {
  return (
    <section className="relative rounded-[2rem] border border-blue-100/80 bg-white/90 p-6 shadow-pt-card backdrop-blur">
      <div className="absolute left-1/2 top-0 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-pt-blue to-pt-purple text-xl font-black text-white shadow-lg">
        {step}
      </div>

      <div className="mb-5 text-center">
        <h2 className="text-2xl font-black text-pt-blue">{title}</h2>
        <p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p>
      </div>

      {children}
    </section>
  );
}
