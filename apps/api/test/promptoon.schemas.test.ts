import { describe, expect, it } from 'vitest';

import {
  createChoiceSchema,
  createCutSchema,
  patchCutSchema,
  patchEpisodeCutLayoutSchema,
  patchEpisodeSchema,
  telemetryEventSchema
} from '../src/modules/promptoon-authoring/promptoon.schemas';

describe('promptoon cut schemas', () => {
  it('accepts episode cover image patches', () => {
    const result = patchEpisodeSchema.safeParse({
      coverImageUrl: '/uploads/2026/04/24/project/cover.webp'
    });

    expect(result.success).toBe(true);
  });

  it('accepts known cut effect values', () => {
    const result = createCutSchema.safeParse({
      kind: 'scene',
      title: 'Intro',
      startEffect: 'fade',
      endEffect: 'zoom-out'
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown cut effect values', () => {
    const result = patchCutSchema.safeParse({
      startEffect: 'blur'
    });

    expect(result.success).toBe(false);
  });

  it('accepts five dialogue vertical anchors', () => {
    for (const dialogAnchorY of ['top', 'upper', 'center', 'lower', 'bottom']) {
      const result = patchCutSchema.safeParse({ dialogAnchorY });
      expect(result.success).toBe(true);
    }
  });

  it('accepts center dialogue horizontal anchor', () => {
    const result = patchCutSchema.safeParse({ dialogAnchorX: 'center' });

    expect(result.success).toBe(true);
  });

  it('accepts signed dialogue offsets', () => {
    const result = patchCutSchema.safeParse({
      dialogAnchorX: 'center',
      dialogAnchorY: 'center',
      dialogOffsetX: -48,
      dialogOffsetY: 96
    });

    expect(result.success).toBe(true);
  });

  it('accepts structured content blocks and effect durations', () => {
    const cutResult = createCutSchema.safeParse({
      kind: 'scene',
      title: 'Intro',
      startEffectDurationMs: 500,
      endEffectDurationMs: 750,
      edgeFade: 'both',
      edgeFadeIntensity: 'minimal',
      edgeFadeColor: 'white',
      marginBottomToken: '10xl',
      stateVariants: [
        {
          id: 'variant-1',
          stateKey: 'first_route',
          equals: 'A',
          variantCutId: '00000000-0000-4000-8000-000000000011',
          label: 'A 루트 연출'
        }
      ],
      stateRoutes: [
        {
          id: 'route-1',
          stateKey: 'first_route',
          equals: 'A',
          conditions: [
            {
              stateKey: 'first_route',
              equals: 'A'
            },
            {
              stateKey: 'second_route',
              equals: 'B'
            }
          ],
          nextCutId: '00000000-0000-4000-8000-000000000012',
          label: 'A 루트'
        }
      ],
      stateFallbackCutId: '00000000-0000-4000-8000-000000000013',
      contentBlocks: [
        {
          id: 'block-1',
          type: 'dialogue',
          speaker: '화자 A',
          text: '안녕하세요',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay',
          fontSizeToken: 'base',
          lineHeightToken: 'relaxed',
          marginTopToken: 'sm',
          marginBottomToken: 'lg'
        },
        {
          id: 'block-2',
          type: 'nameInput',
          placeholder: '이름',
          maxLength: 20,
          required: true,
          bindingKey: 'userName'
        }
      ]
    });
    const choiceResult = createChoiceSchema.safeParse({
      label: '다음으로',
      afterSelectReactionText: '잠시만요',
      stateWrites: [
        {
          key: 'first_route',
          value: 'A'
        }
      ]
    });

    expect(cutResult.success).toBe(true);
    expect(choiceResult.success).toBe(true);
  });

  it('accepts state router cuts', () => {
    const result = createCutSchema.safeParse({
      kind: 'stateRouter',
      title: '상태 분기',
      stateRoutes: [
        {
          id: 'route-a',
          stateKey: 'first_route',
          equals: 'A',
          nextCutId: '00000000-0000-4000-8000-000000000021'
        }
      ],
      stateFallbackCutId: '00000000-0000-4000-8000-000000000022'
    });

    expect(result.success).toBe(true);
  });

  it('accepts result card cuts with template content', () => {
    const result = createCutSchema.safeParse({
      kind: 'resultCard',
      title: 'THE REPLACE',
      assetUrl: '/uploads/result-poster.webp',
      contentBlocks: [
        {
          id: 'result-card-1',
          type: 'resultCard',
          templateId: 'the-replace-final',
          theme: 'blue',
          badge: 'TYPE 01',
          resultName: '합리적인 가해자',
          tagline: '알면서도 손을 들었다',
          lines: ['당신은 명확히 보았다.', '그리고 판단했다.'],
          inflowLabel: 'CHECK IN',
          inflowUrl: 'promtoon.ai',
          inflowBrand: 'PROMTOON',
          inflowTagline: '반응형 웹툰'
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it('accepts state router routes with up to two conditions', () => {
    const result = createCutSchema.safeParse({
      kind: 'stateRouter',
      title: '상태 분기',
      stateRoutes: [
        {
          id: 'route-aa',
          conditions: [
            {
              stateKey: 'first_route',
              equals: 'A'
            },
            {
              stateKey: 'second_route',
              equals: 'A'
            }
          ],
          nextCutId: '00000000-0000-4000-8000-000000000021'
        }
      ],
      stateFallbackCutId: '00000000-0000-4000-8000-000000000022'
    });

    expect(result.success).toBe(true);
  });

  it('rejects incomplete state writes and invalid state variant targets', () => {
    const choiceResult = createChoiceSchema.safeParse({
      label: '다음으로',
      stateWrites: [
        {
          key: 'first route',
          value: 'A'
        }
      ]
    });
    const cutResult = patchCutSchema.safeParse({
      stateVariants: [
        {
          id: 'variant-1',
          stateKey: 'first_route',
          equals: 'A',
          variantCutId: 'not-a-uuid'
        }
      ]
    });
    const routeResult = patchCutSchema.safeParse({
      stateRoutes: [
        {
          id: 'route-1',
          stateKey: 'first_route',
          equals: 'A',
          nextCutId: 'not-a-uuid'
        }
      ]
    });
    const tooManyRouteConditionsResult = patchCutSchema.safeParse({
      stateRoutes: [
        {
          id: 'route-1',
          conditions: [
            {
              stateKey: 'first_route',
              equals: 'A'
            },
            {
              stateKey: 'second_route',
              equals: 'A'
            },
            {
              stateKey: 'third_route',
              equals: 'A'
            }
          ],
          nextCutId: '00000000-0000-4000-8000-000000000021'
        }
      ]
    });

    expect(choiceResult.success).toBe(false);
    expect(cutResult.success).toBe(false);
    expect(routeResult.success).toBe(false);
    expect(tooManyRouteConditionsResult.success).toBe(false);
  });

  it('accepts batch cut layout updates', () => {
    const result = patchEpisodeCutLayoutSchema.safeParse({
      cuts: [
        {
          cutId: '00000000-0000-4000-8000-000000000001',
          positionX: 1010,
          positionY: 2010
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid font tokens and out-of-range effect durations', () => {
    const cutResult = patchCutSchema.safeParse({
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: '본문',
          textAlign: 'left',
          fontToken: 'mono'
        }
      ]
    });
    const choiceResult = patchCutSchema.safeParse({
      endEffectDurationMs: 20001
    });

    expect(cutResult.success).toBe(false);
    expect(choiceResult.success).toBe(false);
  });

  it('rejects invalid content placement values', () => {
    const result = patchCutSchema.safeParse({
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: '본문',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'side'
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid font size values', () => {
    const result = patchCutSchema.safeParse({
      contentBlocks: [
        {
          id: 'block-1',
          type: 'emphasis',
          text: '본문',
          textAlign: 'left',
          fontToken: 'sans-kr',
          fontSizeToken: 'huge'
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid rhythm style tokens', () => {
    const cutResult = patchCutSchema.safeParse({
      edgeFade: 'middle',
      edgeFadeIntensity: 'extreme',
      edgeFadeColor: 'gray',
      marginBottomToken: 'massive'
    });
    const blockResult = patchCutSchema.safeParse({
      contentBlocks: [
        {
          id: 'block-1',
          type: 'narration',
          text: '본문',
          textAlign: 'left',
          fontToken: 'sans-kr',
          lineHeightToken: 'airy',
          marginTopToken: 'wide'
        }
      ]
    });

    expect(cutResult.success).toBe(false);
    expect(blockResult.success).toBe(false);
  });

  it('accepts interactive telemetry fields and rejects invalid durations', () => {
    const validResult = telemetryEventSchema.safeParse({
      publishId: '00000000-0000-4000-8000-000000000001',
      anonymousId: '00000000-0000-4000-8000-000000000002',
      sessionId: '00000000-0000-4000-8000-000000000003',
      eventType: 'choice_click',
      cutId: '00000000-0000-4000-8000-000000000004',
      choiceId: '00000000-0000-4000-8000-000000000005',
      durationMs: 1234
    });
    const invalidResult = telemetryEventSchema.safeParse({
      publishId: '00000000-0000-4000-8000-000000000001',
      anonymousId: '00000000-0000-4000-8000-000000000002',
      sessionId: '00000000-0000-4000-8000-000000000003',
      eventType: 'cut_leave',
      cutId: '00000000-0000-4000-8000-000000000004',
      durationMs: -1
    });

    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });
});
