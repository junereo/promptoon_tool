import type { FeedItem } from '@promptoon/shared';
import { useEffect, useRef } from 'react';

import { createPromptoonSessionId, getPromptoonAnonymousId, sendPromptoonTelemetryEvent } from '../../../shared/lib/promptoon-telemetry';

export function useFeedTelemetry() {
  const anonymousIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    anonymousIdRef.current = getPromptoonAnonymousId();
    sessionIdRef.current = createPromptoonSessionId();
  }, []);

  return {
    trackImpression(item: FeedItem) {
      if (!anonymousIdRef.current || !sessionIdRef.current) {
        return;
      }

      sendPromptoonTelemetryEvent({
        publishId: item.publishId,
        anonymousId: anonymousIdRef.current,
        sessionId: sessionIdRef.current,
        eventType: 'feed_impression',
        cutId: item.startCut.id
      });
    },
    trackChoiceClick(item: FeedItem, choiceId: string) {
      if (!anonymousIdRef.current || !sessionIdRef.current) {
        return;
      }

      sendPromptoonTelemetryEvent({
        publishId: item.publishId,
        anonymousId: anonymousIdRef.current,
        sessionId: sessionIdRef.current,
        eventType: 'feed_choice_click',
        cutId: item.startCut.id,
        choiceId
      });
    }
  };
}
