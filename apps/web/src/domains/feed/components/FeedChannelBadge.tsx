import { Link } from 'react-router-dom';

export function FeedChannelBadge({ channelName, channelSlug }: { channelName?: string | null; channelSlug?: string | null }) {
  const label = channelName ?? 'Promptoon';

  if (!channelSlug) {
    return <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/80">{label}</span>;
  }

  return (
    <Link className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/80 transition hover:bg-black/65" to={`/c/${channelSlug}`}>
      {label}
    </Link>
  );
}
