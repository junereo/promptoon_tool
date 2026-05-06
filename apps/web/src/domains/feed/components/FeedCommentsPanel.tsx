import type { CommunityComment, FeedItem } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loading as Loader2, PaperPlane as SendHorizontal, UserCircle, CloseMd as X } from 'react-coolicons';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { communityApi } from '../../../shared/api/community.api';
import { promptoonKeys } from '../../../shared/api/query-keys';

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getInitial(value: string | null | undefined) {
  return value?.trim().slice(0, 1).toUpperCase() || 'U';
}

function CommentList({
  comments,
  currentUserId,
  isError,
  isLoading
}: {
  comments: CommunityComment[];
  currentUserId?: string;
  isError?: boolean;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center text-sm text-white/55">
        <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
        댓글을 불러오는 중입니다.
      </div>
    );
  }

  if (isError) {
    return <div className="rounded-2xl bg-white/8 p-4 text-sm text-red-100">댓글을 불러오지 못했습니다.</div>;
  }

  if (comments.length === 0) {
    return <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/58">첫 댓글을 남겨보세요.</div>;
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const isMine = comment.userId === currentUserId;
        const authorLabel = isMine ? '나' : '사용자';

        return (
          <article className="flex gap-3" key={comment.id}>
            <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white ring-1 ring-white/15">
              {getInitial(isMine ? authorLabel : comment.userId)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-white">{authorLabel}</span>
                <time className="text-xs text-white/42" dateTime={comment.createdAt}>
                  {formatCommentTime(comment.createdAt)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-white/76">{comment.body}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CommentComposer({
  body,
  currentUserInitial,
  isAuthenticated,
  isPending,
  onBodyChange,
  onLogin,
  onSubmit
}: {
  body: string;
  currentUserInitial: string;
  isAuthenticated: boolean;
  isPending?: boolean;
  onBodyChange: (value: string) => void;
  onLogin: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isAuthenticated) {
    return (
      <button
        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-3 py-3 text-left text-sm text-white/72 transition hover:border-white/20 hover:text-white"
        onClick={onLogin}
        type="button"
      >
        <UserCircle aria-hidden className="h-4 w-4 shrink-0 text-white/72" />
        <span>로그인 후 댓글을 남길 수 있습니다.</span>
      </button>
    );
  }

  return (
    <form className="flex items-center gap-3" onSubmit={onSubmit}>
      <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/12 text-[9px] font-semibold text-white ring-1 ring-white/18">
        {currentUserInitial}
      </div>
      <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/12 bg-white/8 pl-4 pr-1.5">
        <input
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/38"
          disabled={isPending}
          maxLength={2000}
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder="댓글 추가"
          value={body}
        />
        <button
          aria-label="댓글 등록"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={isPending || body.trim().length === 0}
          type="submit"
        >
          {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <SendHorizontal aria-hidden className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}

export function FeedCommentsPanel({
  item,
  onClose,
  onCommentCreated
}: {
  item: FeedItem;
  onClose: () => void;
  onCommentCreated?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const commentsQuery = useQuery({
    queryKey: promptoonKeys.communityComments(item.publishId),
    queryFn: () => communityApi.getComments(item.publishId)
  });
  const metaQuery = useQuery({
    queryKey: promptoonKeys.communityCommentsMeta(item.publishId),
    queryFn: () => communityApi.getCommentsMeta(item.publishId)
  });
  const comments = commentsQuery.data?.comments ?? [];
  const commentCount = metaQuery.data?.commentCount ?? item.metrics?.comments ?? comments.length;
  const currentUserInitial = useMemo(() => getInitial(user?.loginId), [user?.loginId]);
  const createCommentMutation = useMutation({
    mutationFn: (nextBody: string) => communityApi.createComment(item.publishId, nextBody),
    onSuccess: async () => {
      setBody('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityComments(item.publishId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityCommentsMeta(item.publishId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityEmbed(item.publishId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
      onCommentCreated?.();
    }
  });

  function handleLogin() {
    navigate('/login', {
      state: {
        from: `${location.pathname}${location.search}`
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextBody = body.trim();

    if (!nextBody || createCommentMutation.isPending) {
      return;
    }

    void createCommentMutation.mutateAsync(nextBody).catch(() => undefined);
  }

  const title = item.episodeTitle;
  const composer = (
    <CommentComposer
      body={body}
      currentUserInitial={currentUserInitial}
      isAuthenticated={isAuthenticated}
      isPending={createCommentMutation.isPending}
      onBodyChange={setBody}
      onLogin={handleLogin}
      onSubmit={handleSubmit}
    />
  );
  const list = (
    <CommentList
      comments={comments}
      currentUserId={user?.id}
      isError={commentsQuery.isError}
      isLoading={commentsQuery.isLoading}
    />
  );

  return (
    <>
      <aside className="fixed bottom-0 right-0 top-14 z-50 hidden w-[27rem] flex-col border-l border-white/10 bg-zinc-950/96 text-white shadow-[-28px_0_80px_rgba(0,0,0,0.42)] backdrop-blur-xl xl:flex">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold">댓글 {commentCount.toLocaleString('ko-KR')}</p>
            <p className="mt-1 truncate text-xs text-white/45">{title}</p>
          </div>
          <button
            aria-label="댓글 닫기"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{list}</div>
        <div className="shrink-0 border-t border-white/10 px-5 py-4">{composer}</div>
      </aside>

      <div className="fixed inset-0 z-50 xl:hidden">
        <button aria-label="댓글 닫기" className="absolute inset-0 bg-black/45" onClick={onClose} type="button" />
        <section
          aria-labelledby="feed-comments-title"
          aria-modal="true"
          className="absolute inset-x-0 bottom-0 flex h-[70dvh] max-h-[70dvh] min-h-0 flex-col rounded-t-[28px] border-t border-white/10 bg-zinc-950/97 text-white shadow-[0_-24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          role="dialog"
        >
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/24" />
          <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
            <h2 className="text-lg font-semibold" id="feed-comments-title">
              댓글 {commentCount.toLocaleString('ko-KR')}
            </h2>
            <button
              aria-label="댓글 닫기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          </header>

          <div className="shrink-0 border-y border-white/10 px-5 py-3">{composer}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{list}</div>
        </section>
      </div>
    </>
  );
}
