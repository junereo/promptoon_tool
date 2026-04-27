import { DndContext, type DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Choice, Cut, DeleteCutRequest } from '@promptoon/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildCutHierarchy, type CutHierarchyNode } from '../../entities/promptoon/selectors';
import { CutItem } from './CutItem';
import { DeleteCutConfirmModal } from './DeleteCutConfirmModal';
import { SortableCutItem } from './SortableCutItem';

export interface CutListDragPayload {
  activeId: string;
  overId: string;
  parentCutId: string | null;
  siblingCutIds: string[];
  siblingChoiceIds: string[];
}

interface CutBranchGroup {
  key: string;
  instanceKey: string;
  contextNode: CutHierarchyNode | null;
  nodes: CutHierarchyNode[];
  sections: CutChoiceSection[];
}

interface CutChoiceSection {
  key: string;
  label: string;
  nodes: CutHierarchyNode[];
}

interface StoredFoldState {
  branchGroupKeys: Set<string>;
  choiceSectionKeys: Set<string>;
}

function createEmptyFoldState(): StoredFoldState {
  return {
    branchGroupKeys: new Set(),
    choiceSectionKeys: new Set()
  };
}

function parseStoredFoldKeys(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(value.filter((item): item is string => typeof item === 'string'));
}

function readStoredFoldState(storageKey: string | null): StoredFoldState {
  if (!storageKey || typeof window === 'undefined') {
    return createEmptyFoldState();
  }

  try {
    const rawState = window.localStorage.getItem(storageKey);
    if (!rawState) {
      return createEmptyFoldState();
    }

    const parsed = JSON.parse(rawState) as {
      branchGroupKeys?: unknown;
      choiceSectionKeys?: unknown;
    };

    return {
      branchGroupKeys: parseStoredFoldKeys(parsed.branchGroupKeys),
      choiceSectionKeys: parseStoredFoldKeys(parsed.choiceSectionKeys)
    };
  } catch {
    return createEmptyFoldState();
  }
}

function writeStoredFoldState(storageKey: string | null, branchGroupKeys: Set<string>, choiceSectionKeys: Set<string>) {
  if (!storageKey || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      branchGroupKeys: [...branchGroupKeys],
      choiceSectionKeys: [...choiceSectionKeys]
    })
  );
}

function getCompressedRank(rank: string): string {
  const segments = rank.split('.');
  const rootSegment = segments[0];

  if (!rootSegment) {
    return rank;
  }

  const branchSegments = segments.slice(1).filter((segment) => segment !== '1');
  return [rootSegment, ...branchSegments].join('.');
}

function buildBranchGroups(nodes: CutHierarchyNode[], nodeByCutId: Map<string, CutHierarchyNode>): CutBranchGroup[] {
  const groups: CutBranchGroup[] = [];

  for (const node of nodes) {
    const key = getCompressedRank(node.rank);
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.key === key) {
      currentGroup.nodes.push(node);
      continue;
    }

    const group = {
      key,
      instanceKey: `${key}:${groups.length}`,
      contextNode: null,
      nodes: [node],
      sections: []
    };
    groups.push(group);
  }

  for (const group of groups) {
    const firstNode = group.nodes[0];
    const parentNode = firstNode?.parentCutId ? nodeByCutId.get(firstNode.parentCutId) ?? null : null;
    group.contextNode = parentNode && getCompressedRank(parentNode.rank) !== group.key ? parentNode : null;
    group.sections = buildChoiceSections(group);
  }

  return groups;
}

function buildChoiceSections(group: Pick<CutBranchGroup, 'key' | 'nodes'>): CutChoiceSection[] {
  const sections: CutChoiceSection[] = [];

  for (const node of group.nodes) {
    const shouldStartSection = sections.length === 0 || node.cut.kind === 'choice' || node.childNodes.length > 1;

    if (shouldStartSection) {
      sections.push({
        key: `${group.key}:${node.cut.id}`,
        label: `${getCompressedRank(node.rank)} ${node.cut.title}`,
        nodes: [node]
      });
      continue;
    }

    sections[sections.length - 1].nodes.push(node);
  }

  return sections;
}

function uniqueCutsById(cuts: Cut[]): Cut[] {
  const seen = new Set<string>();
  return cuts.filter((cut) => {
    if (seen.has(cut.id)) {
      return false;
    }

    seen.add(cut.id);
    return true;
  });
}

export function CutListPanel({
  choices,
  cuts,
  selectedCutId,
  onCreateCut,
  onDeleteCut,
  onDragEnd,
  onSelectCut
}: {
  choices: Choice[];
  cuts: Cut[];
  selectedCutId: string | null;
  onCreateCut: (anchorCutId?: string) => void;
  onDeleteCut: (cutId: string, payload?: DeleteCutRequest) => Promise<void> | void;
  onDragEnd: (payload: CutListDragPayload) => void;
  onSelectCut: (cutId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );
  const foldStorageKey = cuts[0]?.episodeId ? `promptoon:cut-list-fold:${cuts[0].episodeId}` : null;
  const initialFoldState = readStoredFoldState(foldStorageKey);
  const skipNextFoldPersistRef = useRef(false);
  const [pendingDeleteCut, setPendingDeleteCut] = useState<Cut | null>(null);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [collapsedBranchGroupKeys, setCollapsedBranchGroupKeys] = useState<Set<string>>(() => initialFoldState.branchGroupKeys);
  const [collapsedChoiceSectionKeys, setCollapsedChoiceSectionKeys] = useState<Set<string>>(() => initialFoldState.choiceSectionKeys);
  const [reconnectToCutId, setReconnectToCutId] = useState<string | null>(null);
  const hierarchy = useMemo(() => buildCutHierarchy(cuts, choices), [choices, cuts]);
  const branchGroups = useMemo(
    () => buildBranchGroups(hierarchy.flatNodes, hierarchy.nodeByCutId),
    [hierarchy.flatNodes, hierarchy.nodeByCutId]
  );
  const visibleNodes = useMemo(
    () =>
      branchGroups.flatMap((group) =>
        collapsedBranchGroupKeys.has(group.key)
          ? []
          : group.sections.flatMap((section) => (collapsedChoiceSectionKeys.has(section.key) ? [] : section.nodes))
      ),
    [branchGroups, collapsedBranchGroupKeys, collapsedChoiceSectionKeys]
  );
  const visibleNodeByCutId = useMemo(
    () => new Map(visibleNodes.map((node) => [node.cut.id, node])),
    [visibleNodes]
  );
  const incomingChoiceCount = pendingDeleteCut
    ? choices.filter((choice) => choice.nextCutId === pendingDeleteCut.id).length
    : 0;
  const reconnectCandidates = pendingDeleteCut
    ? uniqueCutsById(
        choices
          .filter((choice) => choice.cutId === pendingDeleteCut.id && choice.nextCutId)
          .map((choice) => cuts.find((cut) => cut.id === choice.nextCutId))
          .filter((cut): cut is Cut => Boolean(cut))
          .filter((cut) => cut.id !== pendingDeleteCut.id)
      )
    : [];

  useEffect(() => {
    const storedFoldState = readStoredFoldState(foldStorageKey);
    skipNextFoldPersistRef.current = true;
    setCollapsedBranchGroupKeys(storedFoldState.branchGroupKeys);
    setCollapsedChoiceSectionKeys(storedFoldState.choiceSectionKeys);
  }, [foldStorageKey]);

  useEffect(() => {
    if (skipNextFoldPersistRef.current) {
      skipNextFoldPersistRef.current = false;
      return;
    }

    writeStoredFoldState(foldStorageKey, collapsedBranchGroupKeys, collapsedChoiceSectionKeys);
  }, [collapsedBranchGroupKeys, collapsedChoiceSectionKeys, foldStorageKey]);

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const activeNode = visibleNodeByCutId.get(activeId);
    const overNode = visibleNodeByCutId.get(overId);

    if (!activeNode || !overNode) {
      return;
    }

    const isSameSiblingGroup = activeNode.siblingGroupKey === overNode.siblingGroupKey;

    onDragEnd({
      activeId,
      overId,
      parentCutId: isSameSiblingGroup ? activeNode.parentCutId : null,
      siblingCutIds: isSameSiblingGroup ? activeNode.siblingCutIds : visibleNodes.map((node) => node.cut.id),
      siblingChoiceIds: isSameSiblingGroup
        ? activeNode.siblingCutIds
            .map((cutId) => hierarchy.nodeByCutId.get(cutId)?.parentChoiceId)
            .filter((choiceId): choiceId is string => Boolean(choiceId))
        : []
    });
  }

  function openDeleteModal(cut: Cut) {
    const candidates = uniqueCutsById(
      choices
        .filter((choice) => choice.cutId === cut.id && choice.nextCutId)
        .map((choice) => cuts.find((candidate) => candidate.id === choice.nextCutId))
        .filter((candidate): candidate is Cut => Boolean(candidate))
        .filter((candidate) => candidate.id !== cut.id)
    );

    setPendingDeleteCut(cut);
    setReconnectToCutId(candidates.length === 1 ? candidates[0].id : null);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteCut || isDeletePending) {
      return;
    }

    setIsDeletePending(true);

    try {
      await onDeleteCut(pendingDeleteCut.id, { reconnectToCutId });
      setPendingDeleteCut(null);
      setReconnectToCutId(null);
    } catch {
      // Keep the modal open so the user can retry if deletion fails.
    } finally {
      setIsDeletePending(false);
    }
  }

  return (
    <>
      <section className="flex h-full flex-col rounded-[28px] border border-editor-border bg-editor-panel/85 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold text-zinc-50">Cut List</p>
            <p className="text-sm text-zinc-400">Drag to reorder. Select, delete, and build the episode flow.</p>
          </div>
          <button
            className="rounded-full bg-editor-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-editor-accentSoft"
            onClick={() => onCreateCut()}
            type="button"
          >
            + Cut
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
          {cuts.length} cut{cuts.length === 1 ? '' : 's'}
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {cuts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-editor-border p-6 text-sm text-zinc-500">
              No cuts yet. Create the first scene to start the episode flow.
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleNodes.map((node) => node.cut.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {branchGroups.map((group) => {
                    const isCollapsed = collapsedBranchGroupKeys.has(group.key);

                    return (
                      <div key={group.instanceKey} className="rounded-2xl border border-editor-border/70 bg-black/10 p-2">
                        <button
                          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} group ${group.key}`}
                          className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.03]"
                          onClick={() => {
                            setCollapsedBranchGroupKeys((current) => {
                              const next = new Set(current);
                              if (next.has(group.key)) {
                                next.delete(group.key);
                              } else {
                                next.add(group.key);
                              }

                              return next;
                            });
                          }}
                          type="button"
                        >
                          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Branch
                            {' '}
                            {group.key}
                          </span>
                          <span className="shrink-0 rounded-full border border-editor-border bg-black/20 px-2 py-1 text-[11px] text-zinc-400">
                            {group.nodes.length}
                            {' '}
                            cut{group.nodes.length === 1 ? '' : 's'}
                            {' '}
                            {isCollapsed ? '+' : '-'}
                          </span>
                        </button>

                        {isCollapsed ? null : (
                          <div className="space-y-2">
                            {group.contextNode ? (
                              <div className="rounded-xl border border-dashed border-editor-border/70 bg-black/15 p-1.5">
                                <div className="mb-1.5 truncate px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                  {group.contextNode.cut.title}
                                  {' '}
                                  -&gt;
                                  {' '}
                                  Branch
                                  {' '}
                                  {group.key}
                                </div>
                                <CutItem
                                  cut={group.contextNode.cut}
                                  dragDisabled
                                  onCreateAfter={() => onCreateCut(group.contextNode!.cut.id)}
                                  onDelete={() => openDeleteModal(group.contextNode!.cut)}
                                  onSelect={() => onSelectCut(group.contextNode!.cut.id)}
                                  rank={getCompressedRank(group.contextNode.rank)}
                                  selected={selectedCutId === group.contextNode.cut.id}
                                />
                              </div>
                            ) : null}
                            {group.sections.map((section) => {
                              const isSectionCollapsed = collapsedChoiceSectionKeys.has(section.key);

                              return (
                                <div key={section.key} className="rounded-xl border border-editor-border/50 bg-black/10 p-1.5">
                                  <button
                                    aria-label={`${isSectionCollapsed ? 'Expand' : 'Collapse'} flow ${section.label}`}
                                    className="mb-1.5 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
                                    onClick={() => {
                                      setCollapsedChoiceSectionKeys((current) => {
                                        const next = new Set(current);
                                        if (next.has(section.key)) {
                                          next.delete(section.key);
                                        } else {
                                          next.add(section.key);
                                        }

                                        return next;
                                      });
                                    }}
                                    type="button"
                                  >
                                    <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                      Choice
                                      {' '}
                                      {section.label}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-zinc-500">
                                      {section.nodes.length}
                                      {' '}
                                      {isSectionCollapsed ? '+' : '-'}
                                    </span>
                                  </button>

                                  {isSectionCollapsed ? null : (
                                    <div className="space-y-3">
                                      {section.nodes.map((node) => (
                                        <SortableCutItem
                                          key={node.cut.id}
                                          cut={node.cut}
                                          indentLevel={1}
                                          onCreateAfter={() => onCreateCut(node.cut.id)}
                                          onDelete={() => openDeleteModal(node.cut)}
                                          onSelect={() => onSelectCut(node.cut.id)}
                                          rank={getCompressedRank(node.rank)}
                                          selected={selectedCutId === node.cut.id}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>
      <DeleteCutConfirmModal
        cut={pendingDeleteCut}
        incomingChoiceCount={incomingChoiceCount}
        isDeleting={isDeletePending}
        onCancel={() => {
          if (isDeletePending) {
            return;
          }

          setPendingDeleteCut(null);
          setReconnectToCutId(null);
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onReconnectChange={setReconnectToCutId}
        reconnectCandidates={reconnectCandidates}
        reconnectToCutId={reconnectToCutId}
      />
    </>
  );
}
