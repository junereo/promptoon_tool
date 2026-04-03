import { arrayMove } from '@dnd-kit/sortable';
import type { EditorSelection, EpisodeDraftResponse } from '@promptoon/shared';
import { create } from 'zustand';

interface PendingAutosaveIds {
  cuts: string[];
  choices: string[];
}

export interface EditorStoreState {
  selected: EditorSelection;
  viewMode: 'list' | 'graph';
  isDirty: boolean;
  localCutOrder: string[];
  pendingAutosaveIds: PendingAutosaveIds;
  hydrateFromDraft: (draft: Pick<EpisodeDraftResponse, 'cuts'>) => void;
  setSelected: (selection: EditorSelection) => void;
  setViewMode: (mode: 'list' | 'graph') => void;
  reorderLocalCuts: (activeId: string, overId: string) => void;
  markDirty: (dirty: boolean) => void;
  markPendingCut: (cutId: string) => void;
  clearPendingCut: (cutId: string) => void;
  markPendingChoice: (choiceId: string) => void;
  clearPendingChoice: (choiceId: string) => void;
  clearDirty: () => void;
  resetForEpisode: () => void;
}

export function createInitialEditorState(): Omit<
  EditorStoreState,
  | 'hydrateFromDraft'
  | 'setSelected'
  | 'setViewMode'
  | 'reorderLocalCuts'
  | 'markDirty'
  | 'markPendingCut'
  | 'clearPendingCut'
  | 'markPendingChoice'
  | 'clearPendingChoice'
  | 'clearDirty'
  | 'resetForEpisode'
> {
  return {
    selected: { type: 'none' },
    viewMode: 'list',
    isDirty: false,
    localCutOrder: [],
    pendingAutosaveIds: {
      cuts: [],
      choices: []
    }
  };
}

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function reconcileLocalCutOrder(currentOrder: string[], serverOrder: string[]): string[] {
  if (currentOrder.length === 0) {
    return serverOrder;
  }

  const serverSet = new Set(serverOrder);
  const kept = currentOrder.filter((cutId) => serverSet.has(cutId));
  const missing = serverOrder.filter((cutId) => !kept.includes(cutId));
  return [...kept, ...missing];
}

function syncLocalCutOrder(currentOrder: string[], serverOrder: string[], isDirty: boolean): string[] {
  if (!isDirty) {
    return serverOrder;
  }

  return reconcileLocalCutOrder(currentOrder, serverOrder);
}

export const useEditorStore = create<EditorStoreState>((set) => ({
  ...createInitialEditorState(),

  hydrateFromDraft: (draft) =>
    set((state) => {
      const serverOrder = [...draft.cuts]
        .sort((left, right) => left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt))
        .map((cut) => cut.id);

      return {
        localCutOrder: syncLocalCutOrder(state.localCutOrder, serverOrder, state.isDirty)
      };
    }),

  setSelected: (selection) => set({ selected: selection }),

  setViewMode: (mode) => set({ viewMode: mode }),

  reorderLocalCuts: (activeId, overId) =>
    set((state) => {
      const activeIndex = state.localCutOrder.indexOf(activeId);
      const overIndex = state.localCutOrder.indexOf(overId);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return state;
      }

      return {
        isDirty: true,
        localCutOrder: arrayMove(state.localCutOrder, activeIndex, overIndex)
      };
    }),

  markDirty: (dirty) => set({ isDirty: dirty }),

  markPendingCut: (cutId) =>
    set((state) => ({
      pendingAutosaveIds: {
        ...state.pendingAutosaveIds,
        cuts: dedupeIds([...state.pendingAutosaveIds.cuts, cutId])
      }
    })),

  clearPendingCut: (cutId) =>
    set((state) => ({
      pendingAutosaveIds: {
        ...state.pendingAutosaveIds,
        cuts: state.pendingAutosaveIds.cuts.filter((id) => id !== cutId)
      }
    })),

  markPendingChoice: (choiceId) =>
    set((state) => ({
      pendingAutosaveIds: {
        ...state.pendingAutosaveIds,
        choices: dedupeIds([...state.pendingAutosaveIds.choices, choiceId])
      }
    })),

  clearPendingChoice: (choiceId) =>
    set((state) => ({
      pendingAutosaveIds: {
        ...state.pendingAutosaveIds,
        choices: state.pendingAutosaveIds.choices.filter((id) => id !== choiceId)
      }
    })),

  clearDirty: () => set({ isDirty: false }),

  resetForEpisode: () =>
    set({
      ...createInitialEditorState()
    })
}));
