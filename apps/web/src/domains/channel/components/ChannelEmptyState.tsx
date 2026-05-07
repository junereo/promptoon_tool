import { Bell, Play } from 'react-coolicons';
import { Link } from 'react-router-dom';

import type { ChannelEmptyStateAction } from '../model/channel.types';

interface ChannelEmptyStateProps {
  action: ChannelEmptyStateAction;
  subtitle: string;
  title: string;
  tone: 'short' | 'promptoon' | 'series';
}

function getActionIcon(kind: ChannelEmptyStateAction['kind']) {
  if (kind === 'notify') {
    return <Bell aria-hidden className="h-4 w-4" />;
  }

  return <Play aria-hidden className="h-4 w-4 fill-current" />;
}

export function ChannelEmptyState({ action, subtitle, title, tone }: ChannelEmptyStateProps) {
  const accentClass = tone === 'short' ? 'from-fuchsia-400/18' : tone === 'promptoon' ? 'from-amber-300/18' : 'from-cyan-300/16';

  return (
    <div className={`rounded-[28px] border border-white/10 bg-gradient-to-br ${accentClass} to-white/[0.045] p-6 shadow-xl shadow-black/16`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-white">
        {getActionIcon(action.kind)}
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/62">{subtitle}</p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
        to={action.href}
      >
        {action.label}
      </Link>
    </div>
  );
}
