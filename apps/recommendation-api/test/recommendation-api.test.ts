import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app/createApp';

describe('recommendation-api', () => {
  it('serves health checks', async () => {
    const app = createApp({
      async recommendFeed() {
        throw new Error('unused');
      }
    });

    await request(app).get('/health').expect(200, { ok: true });
  });

  it('validates and serves feed recommendations', async () => {
    const app = createApp({
      async recommendFeed() {
        return {
          requestId: '00000000-0000-4000-8000-000000000001',
          policyId: 'feed_rule_v1',
          modelVersion: 'rule_ranker_0.1.0',
          experimentId: 'control',
          items: [
            {
              publishId: '00000000-0000-4000-8000-000000000002',
              rank: 1,
              score: 0.5,
              source: 'trending',
              reason: 'trending_signal',
              trackingToken: 'token'
            }
          ],
          nextCursor: null
        };
      }
    });

    await request(app)
      .post('/recommendations/v1/feed')
      .send({
        context: {
          surface: 'discovery_feed',
          device: 'mobile',
          locale: 'ko-KR',
          limit: 10
        }
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.items[0].publishId).toBe('00000000-0000-4000-8000-000000000002');
      });
  });
});
