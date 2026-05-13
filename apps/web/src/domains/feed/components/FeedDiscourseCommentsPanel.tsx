import type { CommunityDiscoursePost, CommunityDiscourseScope, FeedItem } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  Heart01 as Heart,
  Loading as Loader2,
  ChatCircle as MessageCircle,
  PaperPlane as SendHorizontal,
  UserCircle,
  CloseMd as X
} from 'react-coolicons';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { communityApi } from '../../../shared/api/community.api';
import { ApiError } from '../../../shared/api/client';
import { promptoonKeys } from '../../../shared/api/query-keys';

interface CommentTreeNode {
  post: CommunityDiscoursePost;
  replies: CommentTreeNode[];
}

const MAX_REPLY_INDENT_DEPTH = 2;

function getPostKey(post: Pick<CommunityDiscoursePost, 'topicId' | 'postNumber'>): string {
  return `${post.topicId}:${post.postNumber}`;
}

function getReplyParentKey(post: CommunityDiscoursePost): string | null {
  return post.replyToPostNumber ? `${post.topicId}:${post.replyToPostNumber}` : null;
}

function getReplyAncestors(post: CommunityDiscoursePost, posts: CommunityDiscoursePost[]): CommunityDiscoursePost[] {
  const byPostNumber = new Map(posts.map((item) => [getPostKey(item), item]));
  const ancestors: CommunityDiscoursePost[] = [];
  const visited = new Set<string>();
  let current = post;

  while (current.replyToPostNumber) {
    const currentKey = getPostKey(current);
    if (visited.has(currentKey)) {
      break;
    }

    visited.add(currentKey);
    const parent = byPostNumber.get(`${current.topicId}:${current.replyToPostNumber}`);
    if (!parent) {
      break;
    }

    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

function getReplyDepth(post: CommunityDiscoursePost, posts: CommunityDiscoursePost[]): number {
  return getReplyAncestors(post, posts).length;
}

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

function getMissingEnvFromDetails(details: unknown): string[] {
  if (!details || typeof details !== 'object' || !('missingEnv' in details)) {
    return [];
  }

  const missingEnv = (details as { missingEnv?: unknown }).missingEnv;
  return Array.isArray(missingEnv) ? missingEnv.filter((value): value is string => typeof value === 'string') : [];
}

function getCommentErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError && error.status === 503) {
    const missingEnv = getMissingEnvFromDetails(error.details);
    if (missingEnv.length > 0) {
      return `댓글 서버 설정이 필요합니다. API 서버 env: ${missingEnv.join(', ')}`;
    }

    return '댓글 서버 설정이 완료되지 않았습니다.';
  }

  return error instanceof Error ? error.message : '댓글을 등록하지 못했습니다.';
}

function buildCommentTree(posts: CommunityDiscoursePost[]): CommentTreeNode[] {
  const nodes: CommentTreeNode[] = posts.map((post) => ({ post, replies: [] }));
  const byPostNumber = new Map(nodes.map((node) => [getPostKey(node.post), node]));
  const roots: CommentTreeNode[] = [];

  function getNodeAncestors(node: CommentTreeNode): CommentTreeNode[] {
    const ancestors: CommentTreeNode[] = [];
    const visited = new Set<string>();
    let current = node;

    while (current.post.replyToPostNumber) {
      const currentKey = getPostKey(current.post);
      if (visited.has(currentKey)) {
        break;
      }

      visited.add(currentKey);
      const parent = byPostNumber.get(`${current.post.topicId}:${current.post.replyToPostNumber}`);
      if (!parent) {
        break;
      }

      ancestors.unshift(parent);
      current = parent;
    }

    return ancestors;
  }

  function getDisplayParent(node: CommentTreeNode): CommentTreeNode | null {
    const ancestors = getNodeAncestors(node);
    if (ancestors.length === 0) {
      return null;
    }

    if (ancestors.length <= MAX_REPLY_INDENT_DEPTH) {
      return ancestors[ancestors.length - 1] ?? null;
    }

    return ancestors[MAX_REPLY_INDENT_DEPTH - 1] ?? null;
  }

  for (const node of nodes) {
    const parentKey = getReplyParentKey(node.post);
    const parent = parentKey ? byPostNumber.get(parentKey) : null;

    if (parent) {
      getDisplayParent(node)?.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortReplies = (items: CommentTreeNode[]) => {
    items.sort((left, right) => new Date(left.post.createdAt).getTime() - new Date(right.post.createdAt).getTime());
    items.forEach((item) => sortReplies(item.replies));
  };

  roots.sort((left, right) => new Date(right.post.createdAt).getTime() - new Date(left.post.createdAt).getTime());
  roots.forEach((root) => sortReplies(root.replies));
  return roots;
}

function getCappedReplyPostNumber(replyTarget: CommunityDiscoursePost | null, posts: CommunityDiscoursePost[]): number | null {
  if (!replyTarget) {
    return null;
  }

  const ancestors = getReplyAncestors(replyTarget, posts);
  if (ancestors.length < MAX_REPLY_INDENT_DEPTH) {
    return replyTarget.postNumber;
  }

  return ancestors[MAX_REPLY_INDENT_DEPTH - 1]?.postNumber ?? replyTarget.replyToPostNumber ?? replyTarget.postNumber;
}

function getSubmitRawWithMention(raw: string, replyTarget: CommunityDiscoursePost | null, posts: CommunityDiscoursePost[]): string {
  if (!replyTarget || getReplyDepth(replyTarget, posts) < MAX_REPLY_INDENT_DEPTH) {
    return raw;
  }

  const mention = `@${replyTarget.username}`;
  if (raw === mention || raw.startsWith(`${mention} `) || raw.startsWith(`${mention}\n`)) {
    return raw;
  }

  return `${mention} ${raw}`;
}

function CommentAvatar({ post }: { post: CommunityDiscoursePost }) {
  if (post.avatarUrl) {
    return (
      <img
        alt=""
        className="h-[18px] w-[18px] shrink-0 rounded-full bg-white/10 object-cover ring-1 ring-white/15"
        src={post.avatarUrl}
      />
    );
  }

  return (
    <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white ring-1 ring-white/15">
      {getInitial(post.displayName ?? post.username)}
    </div>
  );
}

function CommentItem({
  depth = 0,
  node,
  onLike,
  onReply,
  showSourceLabel
}: {
  depth?: number;
  node: CommentTreeNode;
  onLike: (post: CommunityDiscoursePost) => void;
  onReply: (post: CommunityDiscoursePost) => void;
  showSourceLabel: boolean;
}) {
  const sanitized = useMemo(
    () =>
      DOMPurify.sanitize(node.post.cooked, {
        USE_PROFILES: { html: true }
      }),
    [node.post.cooked]
  );

  return (
    <article className={depth > 0 ? 'ml-8 border-l border-white/10 pl-4' : undefined}>
      <div className="flex gap-3">
        <CommentAvatar post={node.post} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-white">{node.post.displayName ?? node.post.username}</span>
            <span className="text-xs text-white/42">@{node.post.username}</span>
            <time className="text-xs text-white/42" dateTime={node.post.createdAt}>
              {formatCommentTime(node.post.createdAt)}
            </time>
          </div>

          {showSourceLabel ? (
            <div className="mt-1 inline-flex max-w-full rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/62">
              <span className="truncate">{node.post.label}</span>
            </div>
          ) : null}

          <div
            className="mt-2 break-words text-sm leading-6 text-white/78 [&_a]:text-sky-200 [&_blockquote]:border-l [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_p]:mb-2 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />

          <div className="mt-2 flex items-center gap-3 text-xs text-white/52">
            <button
              className="inline-flex items-center gap-1 transition hover:text-white"
              onClick={() => onLike(node.post)}
              type="button"
            >
              <Heart aria-hidden className="h-3.5 w-3.5" />
              {node.post.likeCount.toLocaleString('ko-KR')}
            </button>
            <button className="inline-flex items-center gap-1 transition hover:text-white" onClick={() => onReply(node.post)} type="button">
              <MessageCircle aria-hidden className="h-3.5 w-3.5" />
              답글
            </button>
          </div>
        </div>
      </div>

      {node.replies.length > 0 ? (
        <div className="mt-4 space-y-4">
          {node.replies.map((reply) => (
            <CommentItem
              depth={Math.min(depth + 1, MAX_REPLY_INDENT_DEPTH)}
              key={`${reply.post.topicId}:${reply.post.postNumber}`}
              node={reply}
              onLike={onLike}
              onReply={onReply}
              showSourceLabel={false}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CommentList({
  isError,
  isLoading,
  onLike,
  onReply,
  posts,
  scope
}: {
  isError?: boolean;
  isLoading?: boolean;
  onLike: (post: CommunityDiscoursePost) => void;
  onReply: (post: CommunityDiscoursePost) => void;
  posts: CommunityDiscoursePost[];
  scope: CommunityDiscourseScope;
}) {
  const tree = useMemo(() => buildCommentTree(posts), [posts]);

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

  if (tree.length === 0) {
    return <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/58">첫 댓글을 남겨보세요.</div>;
  }

  return (
    <div className="space-y-5">
      {tree.map((node) => (
        <CommentItem
          key={`${node.post.topicId}:${node.post.postNumber}`}
          node={node}
          onLike={onLike}
          onReply={onReply}
          showSourceLabel={scope === 'project'}
        />
      ))}
    </div>
  );
}

function CommentComposer({
  body,
  currentUserInitial,
  errorMessage,
  isAuthenticated,
  isMentionReply,
  isPending,
  onBodyChange,
  onCancelReply,
  onLogin,
  onSubmit,
  replyTarget
}: {
  body: string;
  currentUserInitial: string;
  errorMessage?: string | null;
  isAuthenticated: boolean;
  isMentionReply?: boolean;
  isPending?: boolean;
  onBodyChange: (value: string) => void;
  onCancelReply: () => void;
  onLogin: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  replyTarget?: CommunityDiscoursePost | null;
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
    <form className="space-y-2" onSubmit={onSubmit}>
      {replyTarget ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2 text-xs text-white/62">
          <span className="min-w-0 truncate">
            @{replyTarget.username}에게 {isMentionReply ? '멘션 답글' : '답글'} 작성 중
          </span>
          <button className="shrink-0 text-white/72 transition hover:text-white" onClick={onCancelReply} type="button">
            취소
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/12 text-[9px] font-semibold text-white ring-1 ring-white/18">
          {currentUserInitial}
        </div>
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/12 bg-white/8 pl-4 pr-1.5">
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/38"
            disabled={isPending}
            maxLength={20000}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder={replyTarget ? '답글 추가' : '댓글 추가'}
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
      </div>
      {errorMessage ? <p className="px-12 text-xs leading-5 text-rose-200">{errorMessage}</p> : null}
    </form>
  );
}

function ScopeTabs({
  scope,
  onScopeChange
}: {
  scope: CommunityDiscourseScope;
  onScopeChange: (scope: CommunityDiscourseScope) => void;
}) {
  return (
    <div className="flex rounded-full border border-white/10 bg-white/6 p-1">
      {([
        ['project', '전체'],
        ['episode', '에피소드']
      ] as const).map(([value, label]) => (
        <button
          aria-pressed={scope === value}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            scope === value ? 'bg-white text-zinc-950' : 'text-white/62 hover:text-white'
          }`}
          key={value}
          onClick={() => onScopeChange(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function FeedDiscourseCommentsPanel({
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
  const [scope, setScope] = useState<CommunityDiscourseScope>('project');
  const [replyTarget, setReplyTarget] = useState<CommunityDiscoursePost | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const commentsQuery = useQuery({
    queryKey: promptoonKeys.communityDiscourseComments(item.publishId, scope),
    queryFn: () => communityApi.getDiscourseComments(item.publishId, scope)
  });
  const metaQuery = useQuery({
    queryKey: promptoonKeys.communityCommentsMeta(item.publishId),
    queryFn: () => communityApi.getCommentsMeta(item.publishId)
  });
  const posts = commentsQuery.data?.posts ?? [];
  const commentCount = commentsQuery.data?.commentCount ?? metaQuery.data?.commentCount ?? item.metrics?.comments ?? posts.length;
  const currentUserInitial = useMemo(() => getInitial(user?.loginId), [user?.loginId]);
  const isMentionReply = replyTarget ? getReplyDepth(replyTarget, posts) >= MAX_REPLY_INDENT_DEPTH : false;

  useEffect(() => {
    setBody('');
    setReplyTarget(null);
  }, [item.publishId, scope]);

  const createCommentMutation = useMutation({
    mutationFn: (nextBody: string) =>
      communityApi.createDiscourseComment(item.publishId, {
        scope,
        raw: getSubmitRawWithMention(nextBody, replyTarget, posts),
        topicId: replyTarget?.topicId ?? null,
        replyToPostNumber: getCappedReplyPostNumber(replyTarget, posts)
      }),
    onSuccess: async () => {
      setBody('');
      setReplyTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityDiscourseComments(item.publishId, 'project') }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityDiscourseComments(item.publishId, 'episode') }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityCommentsMeta(item.publishId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.communityEmbed(item.publishId) }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
      onCommentCreated?.();
    }
  });
  const createCommentErrorMessage = getCommentErrorMessage(createCommentMutation.error);
  const likeMutation = useMutation({
    mutationFn: (postId: string) => communityApi.likeDiscoursePost(postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.communityDiscourseComments(item.publishId, scope) });
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

  function handleLike(post: CommunityDiscoursePost) {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    if (likeMutation.isPending) {
      return;
    }
    void likeMutation.mutateAsync(post.id).catch(() => undefined);
  }

  const tabs = <ScopeTabs onScopeChange={setScope} scope={scope} />;
  const composer = (
    <CommentComposer
      body={body}
      currentUserInitial={currentUserInitial}
      errorMessage={createCommentErrorMessage}
      isAuthenticated={isAuthenticated}
      isMentionReply={isMentionReply}
      isPending={createCommentMutation.isPending}
      onBodyChange={(value) => {
        if (createCommentMutation.isError) {
          createCommentMutation.reset();
        }
        setBody(value);
      }}
      onCancelReply={() => setReplyTarget(null)}
      onLogin={handleLogin}
      onSubmit={handleSubmit}
      replyTarget={replyTarget}
    />
  );
  const list = (
    <CommentList
      isError={commentsQuery.isError}
      isLoading={commentsQuery.isLoading}
      onLike={handleLike}
      onReply={setReplyTarget}
      posts={posts}
      scope={scope}
    />
  );
  const title = commentsQuery.data?.title ?? (scope === 'project' ? `${item.projectTitle} 전체 댓글` : `${item.episodeTitle} 댓글`);

  return (
    <>
      <aside className="feed-comments-desktop-panel fixed z-50 hidden w-[28rem] flex-col border border-white/10 bg-zinc-950/96 text-white shadow-[-28px_0_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <header className="shrink-0 border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
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
          </div>
          <div className="mt-4">{tabs}</div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{list}</div>
        <div className="shrink-0 border-t border-white/10 px-5 py-4">{composer}</div>
      </aside>

      <div className="feed-comments-mobile-panel fixed inset-0 z-50">
        <button aria-label="댓글 닫기" className="absolute inset-0 bg-black/45" onClick={onClose} type="button" />
        <section
          aria-labelledby="feed-comments-title"
          aria-modal="true"
          className="absolute inset-x-0 bottom-0 flex h-[70dvh] max-h-[70dvh] min-h-0 flex-col rounded-t-[28px] border-t border-white/10 bg-zinc-950/97 text-white shadow-[0_-24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          role="dialog"
        >
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/24" />
          <header className="shrink-0 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
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
            </div>
            <p className="mt-1 truncate text-xs text-white/45">{title}</p>
            <div className="mt-4">{tabs}</div>
          </header>

          <div className="shrink-0 border-y border-white/10 px-5 py-3">{composer}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{list}</div>
        </section>
      </div>
    </>
  );
}
