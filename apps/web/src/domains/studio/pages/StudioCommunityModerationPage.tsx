import { ArrowLeftLg as ArrowLeft, Chat as MessageSquare } from 'react-coolicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { communityApi } from '../../../shared/api/community.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

export function StudioCommunityModerationPage() {
  const { publishId } = useParams();
  const embedQuery = useQuery({
    queryKey: promptoonKeys.communityEmbed(publishId ?? ''),
    queryFn: () => communityApi.getCommunityEmbed(publishId ?? ''),
    enabled: Boolean(publishId)
  });

  if (embedQuery.isLoading) {
    return <main className="p-8 text-zinc-300">커뮤니티 관리 정보를 불러오고 있습니다.</main>;
  }

  if (embedQuery.isError || !embedQuery.data) {
    return <main className="p-8 text-red-200">커뮤니티 관리 정보를 불러올 수 없습니다.</main>;
  }

  const embed = embedQuery.data;

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to="/studio/projects">
        <ArrowLeft className="h-4 w-4" />
        Studio로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7">
        <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Community Moderation</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{embed.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">공개 댓글 진입점과 관리 상태를 확인합니다.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-5">
          <MessageSquare className="h-6 w-6 text-editor-accentSoft" />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">Comments</p>
          <p className="mt-2 font-display text-3xl font-semibold text-zinc-50">{embed.commentCount.toLocaleString('ko-KR')}</p>
        </article>
        <article className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-5 lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Public URL</p>
          <Link className="mt-3 block truncate text-sm text-editor-accentSoft hover:text-white" to={embed.discussionUrl ?? `/community/publishes/${embed.publishId}`}>
            {embed.discussionUrl ?? `/community/publishes/${embed.publishId}`}
          </Link>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">Provider</p>
          <p className="mt-2 text-sm text-zinc-300">{embed.provider}</p>
          {embed.provider === 'discourse' && embed.discourseTopicId ? (
            <>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-zinc-500">Discourse Topic</p>
              <p className="mt-2 text-sm text-zinc-300">{embed.discourseTopicId}</p>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
