import type { Choice, Cut } from '@promptoon/shared';
import { memo, useMemo, useState } from 'react';

interface LoopStateSettingOverviewModalProps {
  choices: Choice[];
  cuts: Cut[];
  initialAnchorCutId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: (anchorCutId?: string | null) => void;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onEditGroup: (groupId: string) => void;
  onSelectCut: (cutId: string) => void;
}

interface CutLink {
  choiceLabel?: string;
  sourceCut: Cut | null;
  targetCut: Cut | null;
}

interface StateRouteLink {
  conditions: string;
  label: string;
  routerCut: Cut;
  targetCut: Cut | null;
}

interface LoopStateSettingSummary {
  exitLevelRequired: number | null;
  fallbackLinks: StateRouteLink[];
  groupId: string;
  groupLabel: string;
  incomingLinks: CutLink[];
  internalCutCount: number;
  resultRouterCuts: Cut[];
  routeLinks: StateRouteLink[];
  spacerCount: number;
  stageCuts: Cut[];
  variantCount: number;
}

function getLoopGroupLabel(cut: Cut, groupId: string): string {
  return cut.loopMetadata?.groupLabel?.trim() || groupId;
}

function getCutTitle(cut: Cut | null): string {
  if (!cut) {
    return '연결 없음';
  }

  return cut.title || cut.id;
}

function getCutKindLabel(cut: Cut | null): string {
  return cut ? cut.kind : 'missing';
}

function getRouteConditionsLabel(route: NonNullable<Cut['stateRoutes']>[number]): string {
  const conditions =
    route.conditions && route.conditions.length > 0
      ? route.conditions
      : route.stateKey && route.equals
        ? [{ stateKey: route.stateKey, equals: route.equals }]
        : [];

  if (conditions.length === 0) {
    return 'fallback';
  }

  return conditions.map((condition) => `${condition.stateKey} = ${condition.equals}`).join(' + ');
}

function getStageSortValue(cut: Cut): number {
  return cut.loopMetadata?.stageIndex ?? Number.MAX_SAFE_INTEGER;
}

function buildLoopStateSettingSummaries(cuts: Cut[], choices: Choice[]): LoopStateSettingSummary[] {
  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const groupedCuts = new Map<string, Cut[]>();

  for (const cut of cuts) {
    const metadata = cut.loopMetadata;
    if (metadata?.kind !== 'exitLoop') {
      continue;
    }

    const groupCuts = groupedCuts.get(metadata.groupId) ?? [];
    groupCuts.push(cut);
    groupedCuts.set(metadata.groupId, groupCuts);
  }

  return [...groupedCuts.entries()]
    .map(([groupId, groupCuts]) => {
      const sortedGroupCuts = [...groupCuts].sort(
        (left, right) => left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt)
      );
      const groupCutIds = new Set(sortedGroupCuts.map((cut) => cut.id));
      const stageCuts = sortedGroupCuts
        .filter((cut) => cut.loopMetadata?.role === 'stageBase')
        .sort((left, right) => getStageSortValue(left) - getStageSortValue(right));
      const resultRouterCuts = sortedGroupCuts.filter((cut) => cut.loopMetadata?.role === 'resultRouter');
      const incomingLinks = choices
        .filter((choice) => choice.nextCutId && groupCutIds.has(choice.nextCutId) && !groupCutIds.has(choice.cutId))
        .map((choice) => ({
          choiceLabel: choice.label,
          sourceCut: cutById.get(choice.cutId) ?? null,
          targetCut: choice.nextCutId ? cutById.get(choice.nextCutId) ?? null : null
        }))
        .sort((left, right) => getCutTitle(left.sourceCut).localeCompare(getCutTitle(right.sourceCut)));
      const routeLinks = resultRouterCuts.flatMap((routerCut) =>
        (routerCut.stateRoutes ?? []).map((route) => ({
          conditions: getRouteConditionsLabel(route),
          label: route.label ?? 'Route',
          routerCut,
          targetCut: cutById.get(route.nextCutId) ?? null
        }))
      );
      const fallbackLinks = resultRouterCuts
        .filter((routerCut) => Boolean(routerCut.stateFallbackCutId))
        .map((routerCut) => ({
          conditions: 'fallback',
          label: 'Retry / fallback',
          routerCut,
          targetCut: routerCut.stateFallbackCutId ? cutById.get(routerCut.stateFallbackCutId) ?? null : null
        }));

      return {
        exitLevelRequired:
          stageCuts.find((cut) => typeof cut.loopMetadata?.exitLevelRequired === 'number')?.loopMetadata?.exitLevelRequired ??
          resultRouterCuts.find((cut) => typeof cut.loopMetadata?.exitLevelRequired === 'number')?.loopMetadata?.exitLevelRequired ??
          null,
        fallbackLinks,
        groupId,
        groupLabel: getLoopGroupLabel(sortedGroupCuts[0], groupId),
        incomingLinks,
        internalCutCount: sortedGroupCuts.length,
        resultRouterCuts,
        routeLinks,
        spacerCount: sortedGroupCuts.filter((cut) => cut.loopMetadata?.role === 'spacer').length,
        stageCuts,
        variantCount: sortedGroupCuts.filter((cut) => cut.loopMetadata?.role === 'stageVariant').length
      };
    })
    .sort((left, right) => left.groupLabel.localeCompare(right.groupLabel));
}

function CutReference({
  cut,
  onSelectCut
}: {
  cut: Cut | null;
  onSelectCut: (cutId: string) => void;
}) {
  if (!cut) {
    return <span className="text-zinc-500">연결 없음</span>;
  }

  return (
    <button
      className="min-w-0 truncate text-left text-zinc-100 underline decoration-zinc-600 underline-offset-2 transition hover:text-white hover:decoration-zinc-200"
      onClick={() => onSelectCut(cut.id)}
      title={cut.title}
      type="button"
    >
      {cut.title}
    </button>
  );
}

function RouteLinkRow({
  link,
  onSelectCut
}: {
  link: StateRouteLink;
  onSelectCut: (cutId: string) => void;
}) {
  return (
    <li className="grid gap-1 rounded-lg border border-editor-border/60 bg-black/15 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-zinc-200">{link.label}</span>
        <span className="shrink-0 rounded-full border border-editor-border bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          {getCutKindLabel(link.targetCut)}
        </span>
      </div>
      <div className="grid gap-1 text-xs text-zinc-500">
        <span className="truncate">조건: {link.conditions}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0">출구:</span>
          <CutReference cut={link.targetCut} onSelectCut={onSelectCut} />
        </span>
      </div>
    </li>
  );
}

export const LoopStateSettingOverviewModal = memo(function LoopStateSettingOverviewModal({
  choices,
  cuts,
  initialAnchorCutId,
  isOpen,
  onClose,
  onCreateNew,
  onDeleteGroup,
  onEditGroup,
  onSelectCut
}: LoopStateSettingOverviewModalProps) {
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ groupId: string; message: string } | null>(null);
  const summaries = useMemo(() => buildLoopStateSettingSummaries(cuts, choices), [choices, cuts]);
  const initialAnchorCut = useMemo(
    () => (initialAnchorCutId ? cuts.find((cut) => cut.id === initialAnchorCutId) ?? null : null),
    [cuts, initialAnchorCutId]
  );

  function handleSelectCut(cutId: string) {
    onSelectCut(cutId);
    onClose();
  }

  async function handleDeleteGroup(summary: LoopStateSettingSummary) {
    setDeleteError(null);
    const confirmed = window.confirm(
      `${summary.groupLabel} LoopStateSetting을 삭제할까요?\n\nStage, Variant, Spacer, Result Router 컷과 이 루프로 들어오는 연결이 함께 삭제됩니다.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingGroupId(summary.groupId);
    try {
      await onDeleteGroup(summary.groupId);
    } catch (error) {
      setDeleteError({
        groupId: summary.groupId,
        message: error instanceof Error ? error.message : 'LoopStateSetting 삭제에 실패했습니다.'
      });
    } finally {
      setDeletingGroupId(null);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm">
      <section
        aria-labelledby="loop-state-setting-overview-title"
        className="flex max-h-[90dvh] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-[18px] border border-editor-border bg-editor-panel shadow-2xl shadow-black/50"
        role="dialog"
      >
        <div className="shrink-0 border-b border-editor-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-zinc-50" id="loop-state-setting-overview-title">
                LoopStateSetting State
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                현재 에피소드의 루프 그룹, 진입 연결, 결과 라우터 출구를 확인합니다.
              </p>
              {initialAnchorCut ? (
                <p className="mt-2 text-xs text-lime-100/80">
                  새 LoopStateSetting 기본 진입 컷:
                  {' '}
                  {initialAnchorCut.title}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="rounded-full border border-editor-border px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                onClick={onClose}
                type="button"
              >
                닫기
              </button>
              <button
                className="rounded-full bg-editor-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-editor-accentSoft"
                onClick={() => onCreateNew(initialAnchorCutId)}
                type="button"
              >
                + LoopStateSetting
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {summaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-editor-border p-5 text-sm text-zinc-400">
              아직 LoopStateSetting이 없습니다. `+ LoopStateSetting`으로 새 루프 그룹을 만들 수 있습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {summaries.map((summary) => (
                <article className="rounded-xl border border-editor-border bg-black/10 p-4" key={summary.groupId}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-zinc-50">{summary.groupLabel}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{summary.groupId}</p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-400 md:justify-end">
                        <span className="rounded-full border border-lime-500/30 bg-lime-500/10 px-2 py-1 text-lime-100">
                          Stage {summary.stageCuts.length}
                        </span>
                        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-teal-100">
                          Variant {summary.variantCount}
                        </span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                          Spacer {summary.spacerCount}
                        </span>
                        <span className="rounded-full border border-editor-border bg-black/25 px-2 py-1">
                          Cut {summary.internalCutCount}
                        </span>
                        <span className="rounded-full border border-editor-border bg-black/25 px-2 py-1">
                          탈출 {summary.exitLevelRequired ?? '-'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button
                          className="min-h-10 rounded-full border border-editor-border bg-black/25 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingGroupId !== null}
                          onClick={() => onEditGroup(summary.groupId)}
                          type="button"
                        >
                          편집
                        </button>
                        <button
                          className="min-h-10 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingGroupId !== null}
                          onClick={() => {
                            void handleDeleteGroup(summary);
                          }}
                          type="button"
                        >
                          {deletingGroupId === summary.groupId ? '삭제 중' : '삭제'}
                        </button>
                      </div>
                    </div>
                  </div>
                  {deleteError?.groupId === summary.groupId ? <p className="mt-3 text-xs text-red-200">{deleteError.message}</p> : null}

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <section className="rounded-xl border border-editor-border/70 bg-black/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">State</p>
                      <div className="mt-3 space-y-2 text-sm text-zinc-300">
                        {summary.stageCuts.length === 0 ? (
                          <p className="text-zinc-500">스테이지 컷이 없습니다.</p>
                        ) : (
                          summary.stageCuts.map((stageCut) => (
                            <button
                              className="flex w-full items-center justify-between gap-2 rounded-lg border border-editor-border/60 bg-black/15 px-3 py-2 text-left transition hover:border-zinc-500"
                              key={stageCut.id}
                              onClick={() => handleSelectCut(stageCut.id)}
                              type="button"
                            >
                              <span className="min-w-0 truncate">{stageCut.title}</span>
                              <span className="shrink-0 text-xs text-zinc-500">
                                Stage {stageCut.loopMetadata?.stageIndex ?? '-'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="rounded-xl border border-editor-border/70 bg-black/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">연결됨</p>
                      {summary.incomingLinks.length === 0 ? (
                        <p className="mt-3 rounded-lg border border-dashed border-editor-border/70 px-3 py-2 text-sm text-zinc-500">
                          외부 컷에서 들어오는 연결이 없습니다.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {summary.incomingLinks.map((link, index) => (
                            <li
                              className="grid gap-1 rounded-lg border border-editor-border/60 bg-black/15 px-3 py-2 text-sm"
                              key={`${link.sourceCut?.id ?? 'missing'}:${link.targetCut?.id ?? 'missing'}:${index}`}
                            >
                              <span className="flex min-w-0 items-center gap-1.5 text-zinc-500">
                                <CutReference cut={link.sourceCut} onSelectCut={handleSelectCut} />
                                <span className="shrink-0">→</span>
                                <CutReference cut={link.targetCut} onSelectCut={handleSelectCut} />
                              </span>
                              {link.choiceLabel ? <span className="truncate text-xs text-zinc-500">Choice: {link.choiceLabel}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="rounded-xl border border-editor-border/70 bg-black/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">나가는 곳</p>
                      {summary.routeLinks.length + summary.fallbackLinks.length === 0 ? (
                        <p className="mt-3 rounded-lg border border-dashed border-editor-border/70 px-3 py-2 text-sm text-zinc-500">
                          결과 라우터 출구가 없습니다.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {[...summary.routeLinks, ...summary.fallbackLinks].map((link, index) => (
                            <RouteLinkRow
                              key={`${link.routerCut.id}:${link.label}:${link.targetCut?.id ?? 'missing'}:${index}`}
                              link={link}
                              onSelectCut={handleSelectCut}
                            />
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});
