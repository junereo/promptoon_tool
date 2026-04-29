import type {
  Cut,
  CutContentBlock,
  PromptoonResultCardContentBlock,
  PromptoonResultCardTheme,
  PublishManifest
} from '@promptoon/shared';

type ResultCardRenderableCut =
  | Pick<Cut, 'id' | 'kind' | 'title'> & { contentBlocks?: CutContentBlock[] | null }
  | Pick<PublishManifest['cuts'][number], 'id' | 'kind' | 'title'> & { contentBlocks?: CutContentBlock[] | null };

interface ResultCardPreset {
  theme: PromptoonResultCardTheme;
  badge: string;
  resultName: string;
  tagline: string;
  lines: string[];
}

export interface ResultCardThemeStyle {
  border: string;
  imageTint: string;
  bottomFrom: string;
  bottomTo: string;
  text: string;
  mutedText: string;
  taglineBorder: string;
  inflowBorder: string;
}

export const RESULT_CARD_THEME_OPTIONS: Array<{ label: string; value: PromptoonResultCardTheme }> = [
  { label: 'TYPE 01 blue', value: 'blue' },
  { label: 'TYPE 02 gold', value: 'gold' },
  { label: 'TYPE 03 violet', value: 'violet' },
  { label: 'TYPE 04 red', value: 'red' }
];

export const RESULT_CARD_STAMP_ASSET_URL = '/result-card-stamp.webp';

export const RESULT_CARD_THEME_STYLES: Record<PromptoonResultCardTheme, ResultCardThemeStyle> = {
  blue: {
    border: '#6a98b8',
    imageTint: 'rgba(42,80,120,0.45)',
    bottomFrom: '#1a3450',
    bottomTo: '#08182c',
    text: '#d8e8f8',
    mutedText: 'rgba(216,232,248,0.72)',
    taglineBorder: '#8ab8d8',
    inflowBorder: 'rgba(138,184,216,0.5)'
  },
  gold: {
    border: '#c4a050',
    imageTint: 'rgba(90,72,24,0.45)',
    bottomFrom: '#322818',
    bottomTo: '#1a1408',
    text: '#f0e0b0',
    mutedText: 'rgba(240,224,176,0.72)',
    taglineBorder: '#d4a85c',
    inflowBorder: 'rgba(212,168,92,0.5)'
  },
  violet: {
    border: '#8858a8',
    imageTint: 'rgba(64,24,96,0.45)',
    bottomFrom: '#261438',
    bottomTo: '#0e0820',
    text: '#d8c0e8',
    mutedText: 'rgba(216,192,232,0.72)',
    taglineBorder: '#b888d8',
    inflowBorder: 'rgba(184,136,216,0.5)'
  },
  red: {
    border: '#b85858',
    imageTint: 'rgba(106,32,32,0.45)',
    bottomFrom: '#341818',
    bottomTo: '#1a0808',
    text: '#f0c8c0',
    mutedText: 'rgba(240,200,192,0.72)',
    taglineBorder: '#d87878',
    inflowBorder: 'rgba(216,120,120,0.5)'
  }
};

export const RESULT_CARD_PRESETS: Record<PromptoonResultCardTheme, ResultCardPreset> = {
  blue: {
    theme: 'blue',
    badge: 'TYPE 01',
    resultName: '합리적인 가해자',
    tagline: '알면서도 손을 들었다',
    lines: ['당신은 명확히 보았다.', '그리고 판단했다.', '그 판단은 누군가를 대체했다.']
  },
  gold: {
    theme: 'gold',
    badge: 'TYPE 02',
    resultName: '무지한 가해자',
    tagline: '몰랐다는 말로는 돌아갈 수 없다',
    lines: ['당신은 상황을 다 알지 못했다.', '그러나 선택은 이미 이루어졌다.', '무지는 결과를 지우지 않는다.']
  },
  violet: {
    theme: 'violet',
    badge: 'TYPE 03',
    resultName: '각성한 증인',
    tagline: '늦었지만 외면하지 않았다',
    lines: ['당신은 뒤늦게 깨달았다.', '그리고 침묵하지 않았다.', '증언은 끝난 사건을 다시 움직였다.']
  },
  red: {
    theme: 'red',
    badge: 'TYPE 04',
    resultName: '본능의 선택자',
    tagline: '생존은 가장 빠른 대답이었다',
    lines: ['당신은 오래 생각하지 않았다.', '몸이 먼저 방향을 정했다.', '그 선택은 누구보다 솔직했다.']
  }
};

function createBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `result-card-${Math.random().toString(36).slice(2, 10)}`;
}

export function createResultCardBlock(
  theme: PromptoonResultCardTheme = 'blue',
  overrides: Partial<PromptoonResultCardContentBlock> = {}
): PromptoonResultCardContentBlock {
  const preset = RESULT_CARD_PRESETS[theme];

  return {
    id: overrides.id ?? createBlockId(),
    type: 'resultCard',
    templateId: 'the-replace-final',
    theme: overrides.theme ?? preset.theme,
    badge: overrides.badge ?? preset.badge,
    resultName: overrides.resultName ?? preset.resultName,
    tagline: overrides.tagline ?? preset.tagline,
    lines: overrides.lines ?? preset.lines,
    inflowLabel: overrides.inflowLabel ?? 'CHECK IN',
    inflowUrl: overrides.inflowUrl ?? 'promtoon.ai',
    inflowBrand: overrides.inflowBrand ?? 'PROMTOON',
    inflowTagline: overrides.inflowTagline ?? '반응형 웹툰'
  };
}

export function normalizeResultCardBlock(block: PromptoonResultCardContentBlock): PromptoonResultCardContentBlock {
  const fallback = createResultCardBlock(block.theme, { id: block.id });

  return {
    ...fallback,
    ...block,
    templateId: 'the-replace-final',
    lines: block.lines.length > 0 ? block.lines : fallback.lines
  };
}

export function getResultCardBlock(cut: ResultCardRenderableCut): PromptoonResultCardContentBlock | null {
  const block = cut.contentBlocks?.find((contentBlock): contentBlock is PromptoonResultCardContentBlock => contentBlock.type === 'resultCard');

  if (block) {
    return normalizeResultCardBlock(block);
  }

  if (cut.kind !== 'resultCard') {
    return null;
  }

  return createResultCardBlock('blue', {
    id: `${cut.id}-result-card`,
    resultName: cut.title
  });
}

export function upsertResultCardBlock(
  contentBlocks: CutContentBlock[],
  resultCardBlock: PromptoonResultCardContentBlock
): CutContentBlock[] {
  const existingIndex = contentBlocks.findIndex((block) => block.type === 'resultCard');

  if (existingIndex < 0) {
    return [resultCardBlock];
  }

  return contentBlocks.map((block, index) => (index === existingIndex ? resultCardBlock : block));
}
