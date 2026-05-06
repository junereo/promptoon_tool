import { MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { communityApi } from '../../../shared/api/community.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function CommunityDiscussionPage() {
  const { publishId } = useParams();
  const embedQuery = useQuery({
    queryKey: promptoonKeys.communityEmbed(publishId ?? ''),
    queryFn: () => communityApi.getCommunityEmbed(publishId ?? ''),
    enabled: Boolean(publishId)
  });

  if (embedQuery.isLoading) {
    return <main className="min-h-dvh bg-zinc-950 p-8 text-zinc-300">댓글을 불러오고 있습니다.</main>;
  }

  if (embedQuery.isError || !embedQuery.data) {
    return <main className="min-h-dvh bg-zinc-950 p-8 text-red-200">댓글 공간을 불러올 수 없습니다.</main>;
  }

  const embed = embedQuery.data;

  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6">
      <section className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-editor-accent text-white">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-editor-accentSoft">Community</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{embed.title}</h1>
            <p className="mt-2 text-sm text-zinc-400">댓글 {embed.commentCount.toLocaleString('ko-KR')}개</p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-black/25 p-5">
          {embed.provider === 'discourse' && embed.embedUrl ? (
            <div className="space-y-4">
              <p className="text-sm leading-7 text-zinc-300">Discourse 토론으로 연결된 댓글 공간입니다.</p>
              <a
                className="inline-flex rounded-full bg-editor-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-editor-accentSoft"
                href={embed.embedUrl}
                rel="noreferrer"
                target="_blank"
              >
                Discourse에서 열기
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm leading-7 text-zinc-300">
                현재 댓글 embed는 Promptoon 내부 관리형 토론 공간으로 표시됩니다. Discourse 연결 시 같은 경로에서 외부 thread embed로 교체됩니다.
              </p>
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/25 p-5 text-sm text-zinc-400">
                첫 댓글이 아직 없습니다.
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-editor-accentSoft" to="/feed">
            피드로 돌아가기
          </Link>
          <Link className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-editor-accentSoft" to={`/v/${embed.publishId}`}>
            작품으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
