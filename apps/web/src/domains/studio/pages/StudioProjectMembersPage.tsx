import type { FormEvent } from 'react';
import type { ProjectRole } from '@promptoon/shared';
import { ArrowLeft, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  useAddProjectMember,
  useDeleteProjectMember,
  usePatchProjectMember,
  useProjectMembers,
  useProjects
} from '../../../features/project/hooks/use-project-query';

const ROLE_OPTIONS: Array<{ value: Exclude<ProjectRole, 'owner'>; label: string; description: string }> = [
  { value: 'producer', label: 'Producer', description: '발행과 제작 관리를 수행합니다.' },
  { value: 'writer', label: 'Writer', description: '에피소드와 컷을 편집합니다.' },
  { value: 'viewer', label: 'Viewer', description: '프로젝트를 읽고 검토합니다.' }
];

const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Owner',
  producer: 'Producer',
  writer: 'Writer',
  viewer: 'Viewer'
};

export function StudioProjectMembersPage() {
  const { projectId } = useParams();
  const currentProjectId = projectId ?? '';
  const [loginId, setLoginId] = useState('');
  const [role, setRole] = useState<Exclude<ProjectRole, 'owner'>>('writer');
  const projectsQuery = useProjects();
  const membersQuery = useProjectMembers(projectId);
  const addMember = useAddProjectMember(currentProjectId);
  const patchMember = usePatchProjectMember(currentProjectId);
  const deleteMember = useDeleteProjectMember(currentProjectId);
  const project = projectsQuery.data?.find((item) => item.id === projectId) ?? null;
  const mutationError = [addMember.error, patchMember.error, deleteMember.error].find(Boolean);

  const members = useMemo(() => membersQuery.data?.members ?? [], [membersQuery.data?.members]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedLoginId = loginId.trim();
    if (!trimmedLoginId || !projectId) {
      return;
    }

    await addMember.mutateAsync({ loginId: trimmedLoginId, role });
    setLoginId('');
    setRole('writer');
  }

  if (projectsQuery.isLoading || membersQuery.isLoading) {
    return <StudioPageMessage message="프로젝트 멤버를 불러오고 있습니다." />;
  }

  if (projectsQuery.isError || membersQuery.isError || !project) {
    return <StudioPageMessage tone="error" message="프로젝트 멤버 정보를 불러올 수 없습니다." />;
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200" to={`/studio/projects/${project.id}`}>
        <ArrowLeft className="h-4 w-4" />
        프로젝트로 돌아가기
      </Link>

      <section className="rounded-[32px] border border-editor-border bg-editor-panel/85 p-7 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-editor-accentSoft">Project Members</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-zinc-50">{project.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              프로젝트 단위로 제작, 발행, 검토 권한을 분리합니다. Owner는 삭제하거나 다른 역할로 변경할 수 없습니다.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-300">
            <Users className="h-4 w-4 text-editor-accentSoft" />
            {members.length}명
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <form className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-6" onSubmit={handleSubmit}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-editor-accent/20 text-editor-accentSoft">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-zinc-50">멤버 추가</h2>
              <p className="mt-1 text-sm text-zinc-500">가입된 사용자의 loginId로 초대합니다.</p>
            </div>
          </div>

          <label className="mt-6 block text-sm font-medium text-zinc-300">
            Login ID
            <input
              className="mt-2 w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-editor-accentSoft"
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="creator001"
              value={loginId}
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-zinc-300">
            역할
            <select
              className="mt-2 w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-zinc-100 outline-none transition focus:border-editor-accentSoft"
              onChange={(event) => setRole(event.target.value as Exclude<ProjectRole, 'owner'>)}
              value={role}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-editor-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
            disabled={addMember.isPending || !loginId.trim()}
            type="submit"
          >
            <UserPlus className="h-4 w-4" />
            {addMember.isPending ? '추가 중' : '멤버 추가'}
          </button>

          {mutationError instanceof Error ? <p className="mt-4 text-sm text-red-200">{mutationError.message}</p> : null}
        </form>

        <section className="rounded-[28px] border border-editor-border bg-editor-panel/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-zinc-50">권한 목록</h2>
              <p className="mt-1 text-sm text-zinc-500">Owner, Producer, Writer, Viewer 순서로 표시됩니다.</p>
            </div>
            <ShieldCheck className="h-6 w-6 text-editor-accentSoft" />
          </div>

          <div className="mt-5 grid gap-3">
            {members.map((member) => {
              const isOwner = member.role === 'owner';

              return (
                <article className="rounded-2xl border border-editor-border bg-black/10 p-4" key={member.userId}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-100">{member.loginId}</p>
                      <p className="mt-1 text-xs text-zinc-500">userId: {member.userId}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isOwner ? (
                        <span className="rounded-full border border-editor-accentSoft/40 px-3 py-2 text-xs font-semibold text-editor-accentSoft">
                          {ROLE_LABELS[member.role]}
                        </span>
                      ) : (
                        <select
                          className="rounded-full border border-editor-border bg-black/20 px-3 py-2 text-xs font-semibold text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                          disabled={patchMember.isPending}
                          onChange={(event) =>
                            patchMember.mutate({
                              userId: member.userId,
                              payload: { role: event.target.value as Exclude<ProjectRole, 'owner'> }
                            })
                          }
                          value={member.role}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-editor-border text-zinc-400 transition hover:border-red-400/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isOwner || deleteMember.isPending}
                        onClick={() => deleteMember.mutate(member.userId)}
                        title={isOwner ? 'Owner는 삭제할 수 없습니다.' : '멤버 삭제'}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {ROLE_OPTIONS.map((option) => (
          <article className="rounded-[24px] border border-editor-border bg-editor-panel/70 p-5" key={option.value}>
            <p className="font-display text-lg font-semibold text-zinc-50">{option.label}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{option.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function StudioPageMessage({ message, tone = 'default' }: { message: string; tone?: 'default' | 'error' }) {
  return (
    <main className="w-full px-4 py-12 sm:px-6">
      <div
        className={
          tone === 'error'
            ? 'rounded-[32px] border border-red-500/20 bg-red-500/10 p-8 text-red-100'
            : 'rounded-[32px] border border-editor-border bg-editor-panel/85 p-8 text-zinc-300'
        }
      >
        {message}
      </div>
    </main>
  );
}
