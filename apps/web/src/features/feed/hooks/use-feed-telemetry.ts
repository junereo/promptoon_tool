import type { FeedItem } from '@promptoon/shared';
import { useEffect, useRef } from 'react';

import { getPromptoonAnonymousId, sendPromptoonTelemetryEvent } from '../../../shared/lib/promptoon-telemetry';

export function useFeedTelemetry() {
  const anonymousIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    anonymousIdRef.current = getPromptoonAnonymousId();
  }, []);

  return {
    trackImpression(item: FeedItem) {
      if (!anonymousIdRef.current) {
        return;
      }

      sendPromptoonTelemetryEvent({
        publishId: item.publishId,
        anonymousId: anonymousIdRef.current,
        eventType: 'feed_impression',
        cutId: item.startCut.id
      });
    },
    trackChoiceClick(item: FeedItem, choiceId: string) {
      if (!anonymousIdRef.current) {
        return;
      }

      sendPromptoonTelemetryEvent({
        publishId: item.publishId,
        anonymousId: anonymousIdRef.current,
        eventType: 'feed_choice_click',
        cutId: item.startCut.id,
        choiceId
      });
    }
  };
}
