import type { PublishManifest } from '@promptoon/shared';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useViewerTelemetry } from '../src/features/viewer/hooks/use-viewer-telemetry';

const telemetryMock = vi.hoisted(() => ({
  send: vi.fn(),
  sessionIndex: 0
}));

vi.mock('../src/shared/lib/promptoon-telemetry', () => ({
  createPromptoonSessionId: () => {
    telemetryMock.sessionIndex += 1;
    return `session-${telemetryMock.sessionIndex}`;
  },
  getPromptoonAnonymousId: () => 'anonymous-1',
  sendPromptoonTelemetryEvent: telemetryMock.send
}));

type ViewerCut = PublishManifest['cuts'][number];

function buildCut(overrides: Partial<ViewerCut>): ViewerCut {
  return {
    id: 'cut-1',
    kind: 'choice',
    title: 'Cut',
    body: '',
    contentBlocks: [],
    contentViewMode: 'default',
    dialogAnchorX: 'left',
    dialogAnchorY: 'bottom',
    dialogOffsetX: 0,
    dialogOffsetY: 0,
    dialogTextAlign: 'left',
    startEffect: 'none',
    endEffect: 'none',
    startEffectDurationMs: 320,
    endEffectDurationMs: 320,
    assetUrl: null,
    positionX: 0,
    positionY: 0,
    orderIndex: 0,
    isStart: false,
    isEnding: false,
    choices: [],
    ...overrides
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  telemetryMock.send.mockReset();
  telemetryMock.sessionIndex = 0;
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

describe('useViewerTelemetry', () => {
  it('keeps a session across navigation, tracks choice hesitation, and starts a new session on reset', () => {
    const startCut = buildCut({
      id: 'cut-start',
      choices: [{ id: 'choice-1', label: 'Go', orderIndex: 0, nextCutId: 'cut-end' }]
    });
    const endingCut = buildCut({
      id: 'cut-end',
      kind: 'ending',
      isEnding: true,
      choices: []
    });

    const { result, rerender } = renderHook(
      ({ visibleCuts }) => useViewerTelemetry({ publishId: 'publish-1', visibleCuts }),
      { initialProps: { visibleCuts: [startCut] } }
    );

    expect(telemetryMock.send).toHaveBeenCalledWith(expect.objectContaining({
      cutId: 'cut-start',
      eventType: 'cut_view',
      sessionId: 'session-1'
    }));

    act(() => {
      vi.advanceTimersByTime(1500);
      result.current.trackChoiceClick(startCut.choices[0], startCut.id);
    });

    expect(telemetryMock.send).toHaveBeenCalledWith(expect.objectContaining({
      choiceId: 'choice-1',
      durationMs: 1500,
      eventType: 'choice_click',
      sessionId: 'session-1'
    }));

    rerender({ visibleCuts: [endingCut] });

    expect(telemetryMock.send).toHaveBeenCalledWith(expect.objectContaining({
      cutId: 'cut-start',
      durationMs: 1500,
      eventType: 'cut_leave',
      sessionId: 'session-1'
    }));
    expect(telemetryMock.send).toHaveBeenCalledWith(expect.objectContaining({
      cutId: 'cut-end',
      eventType: 'ending_reach',
      sessionId: 'session-1'
    }));

    act(() => {
      result.current.startNewSession();
    });
    rerender({ visibleCuts: [startCut] });

    expect(telemetryMock.send).toHaveBeenCalledWith(expect.objectContaining({
      cutId: 'cut-start',
      eventType: 'cut_view',
      sessionId: 'session-2'
    }));
  });
});
