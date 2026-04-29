import type { PromptoonResultCardContentBlock } from '@promptoon/shared';
import { describe, expect, it } from 'vitest';

import { createResultCardSvg } from '../src/shared/lib/result-card-export';

function buildResultCardBlock(overrides?: Partial<PromptoonResultCardContentBlock>): PromptoonResultCardContentBlock {
  return {
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
    inflowTagline: '반응형 웹툰',
    ...overrides
  };
}

describe('result card export', () => {
  it('creates a square SVG template from result card fields', async () => {
    const svg = await createResultCardSvg(buildResultCardBlock(), null);

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="960"');
    expect(svg).toContain('height="960"');
    expect(svg).toContain('합리적인 가해자');
    expect(svg).toContain('promtoon.ai');
  });

  it('escapes text fields inside the SVG template', async () => {
    const svg = await createResultCardSvg(
      buildResultCardBlock({
        resultName: 'A < B & C',
        tagline: '"quoted"'
      }),
      null
    );

    expect(svg).toContain('A &lt; B &amp; C');
    expect(svg).toContain('&quot;quoted&quot;');
  });
});
