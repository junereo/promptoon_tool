import { useQuery } from '@tanstack/react-query';
import { ArrowLeftLg as ArrowLeft, ChatCircle as MessageCircle } from 'react-coolicons';
import { useNavigate, useParams } from 'react-router-dom';

import { feedApi } from '../../../shared/api/feed.api';

export function MovingtoonShortViewerPage() {
  const { publishId } = useParams();
  const navigate = useNavigate();
  const shortQuery = useQuery({
    enabled: Boolean(publishId),
    queryKey: ['promptoon', 'shorts', publishId],
    queryFn: () => feedApi.getShort(publishId ?? '')
  });

  if (shortQuery.isLoading) {
    return <main className="flex min-h-dvh items-center justify-center bg-black text-sm text-white/60">Loading short...</main>;
  }

  if (shortQuery.isError || !shortQuery.data || shortQuery.data.type !== 'short_drama') {
    return <main className="flex min-h-dvh items-center justify-center bg-black text-sm text-white/60">Short not found.</main>;
  }

  const item = shortQuery.data;

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-black text-white">
      <button
        aria-label="Back"
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15 transition hover:bg-black/75"
        onClick={() => navigate(-1)}
        type="button"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="relative h-dvh w-full max-w-[min(100vw,56.25dvh)] overflow-hidden bg-black sm:h-[92dvh] sm:rounded-lg sm:ring-1 sm:ring-white/12">
        {item.videoUrl ? (
          <video
            autoPlay
            className="h-full w-full object-cover"
            controls
            playsInline
            poster={item.coverImageUrl ?? undefined}
            src={item.videoUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-950 text-sm text-white/55">Video is not ready.</div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/62">Movingtoon</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">{item.episodeTitle}</h1>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/72">{item.projectTitle}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-white/62">
            <MessageCircle className="h-4 w-4" />
            <span>{item.metrics?.comments ?? 0} comments</span>
          </div>
        </div>
      </div>
    </main>
  );
}
