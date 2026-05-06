import type { AdminUserRoleFilter, PlatformRole, StudioRole } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Database, FileText, MessageSquare, Rocket, Search, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { adminApi } from '../shared/api/admin.api';

function formatDate(value?: string | null): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-admin-blue">Platform Admin</p>
      <h2 className="text-3xl font-black tracking-tight text-admin-ink">{title}</h2>
      <p className="max-w-3xl text-sm leading-6 text-admin-muted">{description}</p>
    </header>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[28px] border border-admin-border bg-white p-5 shadow-admin-card ${className}`}>{children}</section>;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-admin-muted">{label}</p>
          <p className="mt-2 text-3xl font-black text-admin-ink">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-admin-blue">{icon}</div>
      </div>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-admin-border px-4 py-8 text-center text-sm text-admin-muted">{message}</div>;
}

export function DashboardPage() {
  const users = useQuery({ queryKey: ['admin', 'users', 'dashboard'], queryFn: () => adminApi.listUsers() });
  const projects = useQuery({ queryKey: ['admin', 'projects'], queryFn: () => adminApi.listProjects() });
  const publishes = useQuery({ queryKey: ['admin', 'publishes'], queryFn: () => adminApi.listPublishes() });
  const telemetry = useQuery({ queryKey: ['admin', 'telemetry'], queryFn: () => adminApi.getTelemetrySummary() });

  return (
    <div>
      <PageHeader
        description="플랫폼 운영 상태를 한 화면에서 확인합니다. 상세 권한 변경은 Users, 발행과 커뮤니티 상태는 각 운영 메뉴에서 처리합니다."
        title="운영 대시보드"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={users.data?.total ?? '-'} />
        <StatCard icon={<FileText className="h-5 w-5" />} label="Projects" value={projects.data?.projects.length ?? '-'} />
        <StatCard icon={<Rocket className="h-5 w-5" />} label="Publishes" value={publishes.data?.publishes.length ?? '-'} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Telemetry" value={telemetry.data?.totalEvents ?? '-'} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-admin-ink">최근 발행</h3>
            <Link className="text-sm font-bold text-admin-blue" to="/publishes">
              전체 보기
            </Link>
          </div>
          <div className="grid gap-3">
            {(publishes.data?.publishes ?? []).slice(0, 5).map((publish) => (
              <div className="rounded-2xl border border-admin-border px-4 py-3" key={publish.publishId}>
                <p className="font-black text-admin-ink">{publish.episodeTitle}</p>
                <p className="mt-1 text-xs text-admin-muted">
                  {publish.projectTitle} · v{publish.versionNo} · {formatDate(publish.createdAt)}
                </p>
              </div>
            ))}
            {publishes.data?.publishes.length === 0 ? <EmptyState message="발행된 콘텐츠가 없습니다." /> : null}
          </div>
        </Card>

        <Card>
          <h3 className="text-xl font-black text-admin-ink">Telemetry Top Events</h3>
          <div className="mt-4 grid gap-3">
            {(telemetry.data?.events ?? []).slice(0, 6).map((event) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-50 px-4 py-3" key={event.eventName}>
                <p className="truncate text-sm font-bold text-admin-ink">{event.eventName}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-admin-blue">{event.count}</span>
              </div>
            ))}
            {telemetry.data?.events.length === 0 ? <EmptyState message="수집된 이벤트가 없습니다." /> : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AdminUserRoleFilter>('all');
  const users = useQuery({
    queryKey: ['admin', 'users', query, role],
    queryFn: () => adminApi.listUsers({ query, role })
  });
  const platformRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: PlatformRole | null }) => adminApi.updatePlatformRole(userId, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });
  const studioRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StudioRole | null }) => adminApi.updateStudioRole(userId, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    }
  });

  return (
    <div>
      <PageHeader description="platform_admin과 Studio role을 분리해서 부여합니다. Studio role은 제작/발행 접근에만 사용됩니다." title="사용자와 권한" />

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
            <input
              className="w-full rounded-2xl border border-admin-border py-3 pl-11 pr-4 text-sm outline-none focus:border-admin-blue"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="login id, email, display name"
              value={query}
            />
          </label>
          <select
            className="rounded-2xl border border-admin-border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-admin-blue"
            onChange={(event) => setRole(event.target.value as AdminUserRoleFilter)}
            value={role}
          >
            <option value="all">전체</option>
            <option value="platform_admin">Platform admin</option>
            <option value="studio_member">Studio member</option>
            <option value="no_studio">No Studio role</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-admin-muted">
              <tr>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Platform</th>
                <th className="px-3 py-3">Studio</th>
                <th className="px-3 py-3">Projects</th>
                <th className="px-3 py-3">Publishes</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {(users.data?.users ?? []).map((user) => (
                <tr className="border-t border-admin-border" key={user.userId}>
                  <td className="px-3 py-4">
                    <p className="font-black text-admin-ink">{user.displayName || user.loginId}</p>
                    <p className="mt-1 text-xs text-admin-muted">{user.loginId}</p>
                  </td>
                  <td className="px-3 py-4">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-admin-ink">
                      <input
                        checked={user.platformRole === 'platform_admin'}
                        className="h-4 w-4"
                        disabled={platformRoleMutation.isPending}
                        onChange={(event) =>
                          platformRoleMutation.mutate({
                            userId: user.userId,
                            role: event.target.checked ? 'platform_admin' : null
                          })
                        }
                        type="checkbox"
                      />
                      platform_admin
                    </label>
                  </td>
                  <td className="px-3 py-4">
                    <select
                      className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm font-bold outline-none focus:border-admin-blue"
                      disabled={studioRoleMutation.isPending}
                      onChange={(event) =>
                        studioRoleMutation.mutate({
                          userId: user.userId,
                          role: event.target.value === 'none' ? null : (event.target.value as StudioRole)
                        })
                      }
                      value={user.studioRole ?? 'none'}
                    >
                      <option value="none">없음</option>
                      <option value="studio_admin">studio_admin</option>
                      <option value="producer">producer</option>
                      <option value="writer">writer</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                  <td className="px-3 py-4 font-bold text-admin-ink">{user.projectCount}</td>
                  <td className="px-3 py-4 font-bold text-admin-ink">{user.publishCount}</td>
                  <td className="px-3 py-4 text-xs text-admin-muted">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.data?.users.length === 0 ? <EmptyState message="조건에 맞는 사용자가 없습니다." /> : null}
        </div>
      </Card>
    </div>
  );
}

export function ProjectsPage() {
  const projects = useQuery({ queryKey: ['admin', 'projects'], queryFn: () => adminApi.listProjects() });

  return (
    <div>
      <PageHeader description="프로젝트 소유자, 에피소드 수, 발행 수, 멤버 수를 운영 관점에서 조회합니다." title="프로젝트 관리" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-admin-muted">
              <tr>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Episodes</th>
                <th className="px-3 py-3">Publishes</th>
                <th className="px-3 py-3">Latest Publish</th>
              </tr>
            </thead>
            <tbody>
              {(projects.data?.projects ?? []).map((project) => (
                <tr className="border-t border-admin-border" key={project.projectId}>
                  <td className="px-3 py-4 font-black text-admin-ink">{project.title}</td>
                  <td className="px-3 py-4 text-admin-muted">{project.ownerLoginId}</td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-admin-blue">{project.status}</span>
                  </td>
                  <td className="px-3 py-4 font-bold">{project.episodeCount}</td>
                  <td className="px-3 py-4 font-bold">{project.publishCount}</td>
                  <td className="px-3 py-4 text-xs text-admin-muted">{formatDate(project.latestPublishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.data?.projects.length === 0 ? <EmptyState message="프로젝트가 없습니다." /> : null}
        </div>
      </Card>
    </div>
  );
}

export function PublishesPage() {
  const publishes = useQuery({ queryKey: ['admin', 'publishes'], queryFn: () => adminApi.listPublishes() });

  return (
    <div>
      <PageHeader description="발행 이력과 Feed projection, Discourse sync 상태를 함께 확인합니다." title="발행 관리" />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-admin-muted">
              <tr>
                <th className="px-3 py-3">Publish</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Version</th>
                <th className="px-3 py-3">Feed</th>
                <th className="px-3 py-3">Discourse</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {(publishes.data?.publishes ?? []).map((publish) => (
                <tr className="border-t border-admin-border" key={publish.publishId}>
                  <td className="px-3 py-4">
                    <p className="font-black text-admin-ink">{publish.episodeTitle}</p>
                    <p className="mt-1 text-xs text-admin-muted">#{publish.episodeNo} · {publish.createdByLoginId}</p>
                  </td>
                  <td className="px-3 py-4 text-admin-muted">{publish.projectTitle}</td>
                  <td className="px-3 py-4 font-bold">v{publish.versionNo}</td>
                  <td className="px-3 py-4">
                    {publish.feedItemId ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <span className="text-admin-muted">-</span>}
                  </td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      {publish.discourseSyncStatus ?? 'none'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-xs text-admin-muted">{formatDate(publish.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {publishes.data?.publishes.length === 0 ? <EmptyState message="발행 이력이 없습니다." /> : null}
        </div>
      </Card>
    </div>
  );
}

export function CommunityPage() {
  const discourse = useQuery({ queryKey: ['admin', 'community', 'discourse'], queryFn: () => adminApi.getDiscourseSummary() });
  const statusMap = useMemo(() => new Map((discourse.data?.statuses ?? []).map((status) => [status.status, status.count])), [discourse.data]);

  return (
    <div>
      <PageHeader description="Discourse thread sync 상태와 최근 연동 항목을 확인합니다." title="Community / Discourse" />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<MessageSquare className="h-5 w-5" />} label="Pending" value={statusMap.get('pending') ?? 0} />
        <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Synced" value={statusMap.get('synced') ?? 0} />
        <StatCard icon={<Database className="h-5 w-5" />} label="Failed" value={statusMap.get('failed') ?? 0} />
      </section>

      <Card className="mt-5">
        <h3 className="text-xl font-black text-admin-ink">최근 Sync</h3>
        <div className="mt-4 grid gap-3">
          {(discourse.data?.latest ?? []).map((item) => (
            <div className="rounded-2xl border border-admin-border px-4 py-3" key={item.publishId}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-admin-ink">{item.episodeTitle}</p>
                  <p className="mt-1 text-xs text-admin-muted">{item.projectTitle} · topic {item.discourseTopicId ?? '-'}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-admin-blue">{item.syncStatus}</span>
              </div>
              {item.lastError ? <p className="mt-2 text-xs font-bold text-rose-600">{item.lastError}</p> : null}
            </div>
          ))}
          {discourse.data?.latest.length === 0 ? <EmptyState message="Discourse sync 항목이 없습니다." /> : null}
        </div>
      </Card>
    </div>
  );
}

export function TelemetryPage() {
  const telemetry = useQuery({ queryKey: ['admin', 'telemetry'], queryFn: () => adminApi.getTelemetrySummary() });

  return (
    <div>
      <PageHeader description="도메인별 event count와 최근 event 집계를 확인합니다." title="Telemetry" />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Activity className="h-5 w-5" />} label="Total events" value={telemetry.data?.totalEvents ?? '-'} />
        {(telemetry.data?.domains ?? []).slice(0, 2).map((domain) => (
          <StatCard icon={<Database className="h-5 w-5" />} key={domain.domain} label={domain.domain} value={domain.count} />
        ))}
      </section>

      <Card className="mt-5">
        <h3 className="text-xl font-black text-admin-ink">Event Summary</h3>
        <div className="mt-4 grid gap-3">
          {(telemetry.data?.events ?? []).map((event) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-border px-4 py-3" key={event.eventName}>
              <div>
                <p className="font-black text-admin-ink">{event.eventName}</p>
                <p className="mt-1 text-xs text-admin-muted">latest {formatDate(event.latestAt)}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-admin-blue">{event.count}</span>
            </div>
          ))}
          {telemetry.data?.events.length === 0 ? <EmptyState message="수집된 Telemetry 이벤트가 없습니다." /> : null}
        </div>
      </Card>
    </div>
  );
}
