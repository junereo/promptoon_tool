import { beforeEach, describe, expect, it } from 'vitest';

import { useViewerStore } from '../src/features/viewer/store/use-viewer-store';

describe('useViewerStore', () => {
  beforeEach(() => {
    useViewerStore.setState({
      publishId: null,
      currentCutId: null,
      historyStack: [],
      navigationDirection: 'reset',
      isChromeVisible: true
    });
  });

  it('tracks push, pop, and reset navigation with direction state', () => {
    const store = useViewerStore.getState();

    store.initialize('publish-1', 'cut-start');
    store.push('cut-middle');
    store.push('cut-end');

    expect(useViewerStore.getState().historyStack).toEqual(['cut-start', 'cut-middle']);
    expect(useViewerStore.getState().currentCutId).toBe('cut-end');
    expect(useViewerStore.getState().navigationDirection).toBe('forward');

    store.pop();
    expect(useViewerStore.getState().currentCutId).toBe('cut-middle');
    expect(useViewerStore.getState().historyStack).toEqual(['cut-start']);
    expect(useViewerStore.getState().navigationDirection).toBe('backward');

    store.reset('cut-start');
    expect(useViewerStore.getState().currentCutId).toBe('cut-start');
    expect(useViewerStore.getState().historyStack).toEqual([]);
    expect(useViewerStore.getState().navigationDirection).toBe('reset');
  });

  it('does not reinitialize progress for the same publish id', () => {
    const store = useViewerStore.getState();

    store.initialize('publish-1', 'cut-start');
    store.push('cut-middle');
    store.initialize('publish-1', 'cut-start');

    expect(useViewerStore.getState().currentCutId).toBe('cut-middle');
    expect(useViewerStore.getState().historyStack).toEqual(['cut-start']);
  });

  it('initializes feed entry state with a hidden start cut in history', () => {
    const store = useViewerStore.getState();

    store.initializeFromFeed('publish-1', 'cut-start', 'cut-end');

    expect(useViewerStore.getState().currentCutId).toBe('cut-end');
    expect(useViewerStore.getState().historyStack).toEqual(['cut-start']);
    expect(useViewerStore.getState().navigationDirection).toBe('forward');

    store.pop();
    expect(useViewerStore.getState().currentCutId).toBe('cut-start');
    expect(useViewerStore.getState().historyStack).toEqual([]);
  });
});
