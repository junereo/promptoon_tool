import { describe, expect, it } from 'vitest';

import { createChoiceSchema, createCutSchema, patchCutSchema, telemetryEventSchema } from '../src/modules/promptoon-authoring/promptoon.schemas';

describe('promptoon cut schemas', () => {
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

  it('accepts structured content blocks and effect durations', () => {
    const cutResult = createCutSchema.safeParse({
      kind: 'scene',
      title: 'Intro',
      startEffectDurationMs: 500,
      endEffectDurationMs: 750,
      edgeFade: 'both',
      edgeFadeIntensity: 'strong',
      marginBottomToken: '10xl',
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
      afterSelectReactionText: '잠시만요'
    });

    expect(cutResult.success).toBe(true);
    expect(choiceResult.success).toBe(true);
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
