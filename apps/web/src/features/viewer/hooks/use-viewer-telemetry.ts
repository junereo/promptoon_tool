import type { PublishManifest, TelemetryEventRequest } from '@promptoon/shared';
import { useEffect, useRef } from 'react';

import { getPromptoonAnonymousId, sendPromptoonTelemetryEvent } from '../../../shared/lib/promptoon-telemetry';

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
  const lastEndingCutIdRef = useRef<string | null>(null);
  const lastVisibleCutIdsRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    anonymousIdRef.current = getPromptoonAnonymousId();
  }, []);

  useEffect(() => {
    if (!publishId || visibleCuts.length === 0 || !anonymousIdRef.current) {
      return;
    }

    const visibleCutIds = visibleCuts.map((cut) => cut.id).join(',');
    if (lastVisibleCutIdsRef.current === visibleCutIds) {
      return;
    }

    lastVisibleCutIdsRef.current = visibleCutIds;

    for (const cut of visibleCuts) {
      sendTelemetryEvent({
        publishId,
        anonymousId: anonymousIdRef.current,
        eventType: 'cut_view',
        cutId: cut.id
      });
    }

    const endingCut = visibleCuts.find((cut) => cut.isEnding || cut.kind === 'ending') ?? null;
    if (endingCut && lastEndingCutIdRef.current !== endingCut.id) {
      lastEndingCutIdRef.current = endingCut.id;
      sendTelemetryEvent({
        publishId,
        anonymousId: anonymousIdRef.current,
        eventType: 'ending_reach',
        cutId: endingCut.id
      });
    }
  }, [publishId, visibleCuts]);

  return {
    trackChoiceClick(choice: ViewerChoice, cutId: string) {
      if (!anonymousIdRef.current) {
        return;
      }

      sendTelemetryEvent({
        publishId,
        anonymousId: anonymousIdRef.current,
        eventType: 'choice_click',
        cutId,
        choiceId: choice.id
      });
    }
  };
}
