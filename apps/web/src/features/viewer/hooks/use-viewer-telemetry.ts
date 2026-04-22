import type { PublishManifest, TelemetryEventRequest } from '@promptoon/shared';
import { useEffect, useRef } from 'react';

import { createPromptoonSessionId, getPromptoonAnonymousId, sendPromptoonTelemetryEvent } from '../../../shared/lib/promptoon-telemetry';

type ViewerCut = PublishManifest['cuts'][number];
type ViewerChoice = ViewerCut['choices'][number];

function sendTelemetryEvent(payload: TelemetryEventRequest) {
  sendPromptoonTelemetryEvent(payload);
}

export function useViewerTelemetry({
  publishId,
  visibleCuts
}: {
  publishId: string;
  visibleCuts: ViewerCut[];
}) {
  const anonymousIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const activeCutStartedAtRef = useRef<Map<string, number>>(new Map());
  const choiceShownAtByCutIdRef = useRef<Map<string, number>>(new Map());
  const lastEndingCutIdRef = useRef<string | null>(null);
  const viewedCutIdsRef = useRef<Set<string>>(new Set());

  function sendSessionTelemetryEvent(payload: Omit<TelemetryEventRequest, 'anonymousId' | 'publishId' | 'sessionId'>) {
    if (!anonymousIdRef.current || !sessionIdRef.current) {
      return;
    }

    sendTelemetryEvent({
      publishId,
      anonymousId: anonymousIdRef.current,
      sessionId: sessionIdRef.current,
      ...payload
    });
  }

  function flushCutDuration(cutId: string, endedAt: number) {
    const startedAt = activeCutStartedAtRef.current.get(cutId);
    if (typeof startedAt !== 'number') {
      return;
    }

    activeCutStartedAtRef.current.delete(cutId);
    choiceShownAtByCutIdRef.current.delete(cutId);

    sendSessionTelemetryEvent({
      eventType: 'cut_leave',
      cutId,
      durationMs: Math.max(0, Math.round(endedAt - startedAt))
    });
  }

  function startNewSession() {
    const now = Date.now();
    for (const cutId of activeCutStartedAtRef.current.keys()) {
      flushCutDuration(cutId, now);
    }

    sessionIdRef.current = createPromptoonSessionId();
    activeCutStartedAtRef.current.clear();
    choiceShownAtByCutIdRef.current.clear();
    viewedCutIdsRef.current.clear();
    lastEndingCutIdRef.current = null;
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    anonymousIdRef.current = getPromptoonAnonymousId();
    sessionIdRef.current = createPromptoonSessionId();
  }, []);

  useEffect(() => {
    if (!publishId || visibleCuts.length === 0 || !anonymousIdRef.current || !sessionIdRef.current) {
      return;
    }

    const now = Date.now();
    const currentCutIds = new Set(visibleCuts.map((cut) => cut.id));

    for (const cutId of activeCutStartedAtRef.current.keys()) {
      if (!currentCutIds.has(cutId)) {
        flushCutDuration(cutId, now);
      }
    }

    for (const cut of visibleCuts) {
      if (!activeCutStartedAtRef.current.has(cut.id)) {
        activeCutStartedAtRef.current.set(cut.id, now);
      }

      if (!viewedCutIdsRef.current.has(cut.id)) {
        viewedCutIdsRef.current.add(cut.id);
        sendSessionTelemetryEvent({
          eventType: 'cut_view',
          cutId: cut.id
        });
      }

      if (cut.kind !== 'scene' && cut.choices.length > 0 && !choiceShownAtByCutIdRef.current.has(cut.id)) {
        choiceShownAtByCutIdRef.current.set(cut.id, now);
      }
    }

    const endingCut = visibleCuts.find((cut) => cut.isEnding || cut.kind === 'ending') ?? null;
    if (endingCut && lastEndingCutIdRef.current !== endingCut.id) {
      lastEndingCutIdRef.current = endingCut.id;
      sendSessionTelemetryEvent({
        eventType: 'ending_reach',
        cutId: endingCut.id
      });
    }
  }, [publishId, visibleCuts]);

  useEffect(() => {
    return () => {
      const now = Date.now();
      for (const cutId of activeCutStartedAtRef.current.keys()) {
        flushCutDuration(cutId, now);
      }
    };
  }, []);

  return {
    startNewSession,
    trackChoiceClick(choice: ViewerChoice, cutId: string) {
      if (!anonymousIdRef.current || !sessionIdRef.current) {
        return;
      }

      const choiceShownAt = choiceShownAtByCutIdRef.current.get(cutId);
      sendSessionTelemetryEvent({
        eventType: 'choice_click',
        cutId,
        choiceId: choice.id,
        durationMs: typeof choiceShownAt === 'number' ? Math.max(0, Math.round(Date.now() - choiceShownAt)) : undefined
      });
    },
    trackEndingShare(cutId: string) {
      sendSessionTelemetryEvent({
        eventType: 'ending_share',
        cutId
      });
    }
  };
}
