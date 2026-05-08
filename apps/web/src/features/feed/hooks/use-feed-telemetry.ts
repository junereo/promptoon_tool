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

  function getRecommendationPayload(item: FeedItem, position?: number) {
    if (!item.recommendation) {
      return position
        ? {
            position
          }
        : {};
    }

    return {
      surface: item.recommendation.surface,
      position,
      trackingToken: item.recommendation.trackingToken,
      recommendationRequestId: item.recommendation.requestId,
      policyId: item.recommendation.policyId,
      modelVersion: item.recommendation.modelVersion,
      experimentId: item.recommendation.experimentId
    };
  }

  return {
    trackImpression(item: FeedItem, position?: number) {
      if (!anonymousIdRef.current || !sessionIdRef.current) {
        return;
      }

      sendPromptoonTelemetryEvent({
        publishId: item.publishId,
        anonymousId: anonymousIdRef.current,
        sessionId: sessionIdRef.current,
        eventType: 'feed_impression',
        cutId: item.startCut.id,
        ...getRecommendationPayload(item, position)
      });
    },
    trackChoiceClick(item: FeedItem, choiceId: string, position?: number) {
      if (!anonymousIdRef.current || !sessionIdRef.current) {
        return;
      }

      sendPromptoonTelemetryEvent({
        publishId: item.publishId,
        anonymousId: anonymousIdRef.current,
        sessionId: sessionIdRef.current,
        eventType: 'feed_choice_click',
        cutId: item.startCut.id,
        choiceId,
        ...getRecommendationPayload(item, position)
      });
    }
  };
}
