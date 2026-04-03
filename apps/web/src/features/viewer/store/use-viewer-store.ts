import { create } from 'zustand';

export type ViewerNavigationDirection = 'forward' | 'backward' | 'reset';

interface ViewerState {
  publishId: string | null;
  currentCutId: string | null;
  historyStack: string[];
  navigationDirection: ViewerNavigationDirection;
  isChromeVisible: boolean;
  initialize: (publishId: string, startCutId: string) => void;
  initializeFromFeed: (publishId: string, startCutId: string, nextCutId: string) => void;
  push: (nextCutId: string) => void;
  pop: () => void;
  reset: (startCutId: string) => void;
  showChrome: () => void;
  hideChrome: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  publishId: null,
  currentCutId: null,
  historyStack: [],
  navigationDirection: 'reset',
  isChromeVisible: true,
  initialize: (publishId, startCutId) =>
    set((state) => {
      if (state.publishId === publishId && state.currentCutId) {
        return state;
      }

      return {
        publishId,
        currentCutId: startCutId,
        historyStack: [],
        navigationDirection: 'reset',
        isChromeVisible: true
      };
    }),
  initializeFromFeed: (publishId, startCutId, nextCutId) =>
    set((state) => {
      if (
        state.publishId === publishId &&
        state.currentCutId === nextCutId &&
        state.historyStack.length === 1 &&
        state.historyStack[0] === startCutId
      ) {
        return state;
      }

      return {
        publishId,
        currentCutId: nextCutId,
        historyStack: [startCutId],
        navigationDirection: 'forward',
        isChromeVisible: true
      };
    }),
  push: (nextCutId) =>
    set((state) => {
      if (!state.currentCutId || state.currentCutId === nextCutId) {
        return state;
      }

      return {
        currentCutId: nextCutId,
        historyStack: [...state.historyStack, state.currentCutId],
        navigationDirection: 'forward'
      };
    }),
  pop: () =>
    set((state) => {
      const previousCutId = state.historyStack[state.historyStack.length - 1];

      if (!previousCutId) {
        return state;
      }

      return {
        currentCutId: previousCutId,
        historyStack: state.historyStack.slice(0, -1),
        navigationDirection: 'backward'
      };
    }),
  reset: (startCutId) =>
    set({
      currentCutId: startCutId,
      historyStack: [],
      navigationDirection: 'reset'
    }),
  showChrome: () =>
    set((state) => {
      if (state.isChromeVisible) {
        return state;
      }

      return { isChromeVisible: true };
    }),
  hideChrome: () =>
    set((state) => {
      if (!state.isChromeVisible) {
        return state;
      }

      return { isChromeVisible: false };
    })
}));
