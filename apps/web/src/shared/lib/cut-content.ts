import type {
  CutContentBlock,
  Cut,
  PromptoonContentPlacement,
  PromptoonFontSizeToken,
  PromptoonLineHeightToken,
  PromptoonSpacingToken,
  PromptoonContentTextAlign,
  PromptoonFontToken,
  PromptoonHeadingContentBlock,
  PromptoonNarrationContentBlock,
  PublishManifest,
  PromptoonQuoteContentBlock,
  PromptoonEmphasisContentBlock
} from '@promptoon/shared';

const DEFAULT_NAME_INPUT_MAX_LENGTH = 20;
const DEFAULT_CONTENT_FONT_TOKEN: PromptoonFontToken = 'sans-kr';
const DEFAULT_CONTENT_FONT_SIZE: PromptoonFontSizeToken = 'lg';
const DEFAULT_CONTENT_LINE_HEIGHT: PromptoonLineHeightToken = 'normal';
const DEFAULT_CONTENT_TEXT_ALIGN: PromptoonContentTextAlign = 'left';

export interface ViewerBindings {
  userName: string;
}

type ContentRenderableCut =
  | Pick<Cut, 'id' | 'body'> & { contentBlocks?: CutContentBlock[] | null }
  | Pick<PublishManifest['cuts'][number], 'id' | 'body'> & { contentBlocks?: CutContentBlock[] | null };

export const CONTENT_FONT_OPTIONS: Array<{ label: string; value: PromptoonFontToken }> = [
  { label: 'Sans KR', value: 'sans-kr' },
  { label: 'Serif KR', value: 'serif-kr' },
  { label: 'Display', value: 'display' }
];

export const CONTENT_FONT_SIZE_OPTIONS: Array<{ label: string; value: PromptoonFontSizeToken }> = [
  { label: 'Small', value: 'sm' },
  { label: 'Normal', value: 'base' },
  { label: 'Large', value: 'lg' },
  { label: 'Extra Large', value: 'xl' },
  { label: 'Title', value: '2xl' },
  { label: 'Hero', value: '3xl' }
];

export const CONTENT_LINE_HEIGHT_OPTIONS: Array<{ label: string; value: PromptoonLineHeightToken }> = [
  { label: 'Tight', value: 'tight' },
  { label: 'Normal', value: 'normal' },
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'Loose', value: 'loose' }
];

export const CONTENT_SPACING_OPTIONS: Array<{ label: string; value: PromptoonSpacingToken }> = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: 'sm' },
  { label: 'Normal', value: 'base' },
  { label: 'Large', value: 'lg' },
  { label: 'Extra Large', value: 'xl' },
  { label: '2XL', value: '2xl' },
  { label: '3XL', value: '3xl' },
  { label: '4XL', value: '4xl' },
  { label: '5XL', value: '5xl' },
  { label: '6XL', value: '6xl' },
  { label: '7XL', value: '7xl' },
  { label: '8XL', value: '8xl' },
  { label: '9XL', value: '9xl' },
  { label: '10XL', value: '10xl' }
];

export const CONTENT_ALIGN_OPTIONS: Array<{ label: string; value: PromptoonContentTextAlign }> = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' }
];

export const CONTENT_PLACEMENT_OPTIONS: Array<{ label: string; value: PromptoonContentPlacement }> = [
  { label: 'Flow', value: 'flow' },
  { label: 'Overlay', value: 'overlay' }
];

export const CONTENT_BLOCK_TYPE_OPTIONS: Array<{ label: string; value: CutContentBlock['type'] }> = [
  { label: 'Heading', value: 'heading' },
  { label: 'Narration', value: 'narration' },
  { label: 'Dialogue', value: 'dialogue' },
  { label: 'Quote', value: 'quote' },
  { label: 'Emphasis', value: 'emphasis' },
  { label: 'Image', value: 'image' },
  { label: 'Name Input', value: 'nameInput' }
];

export function getContentFontFamily(fontToken: PromptoonFontToken): string {
  switch (fontToken) {
    case 'serif-kr':
      return '"Noto Serif KR", Georgia, serif';
    case 'display':
      return '"Playfair Display", "Space Grotesk", serif';
    case 'sans-kr':
    default:
      return '"Noto Sans KR", "IBM Plex Sans", sans-serif';
  }
}

export function getContentFontSizeClassName(fontSizeToken?: PromptoonFontSizeToken): string {
  switch (fontSizeToken ?? DEFAULT_CONTENT_FONT_SIZE) {
    case 'sm':
      return 'text-[clamp(0.75rem,min(3.59vw,1.66dvh),0.875rem)]';
    case 'lg':
      return 'text-[clamp(0.9375rem,min(4.62vw,2.13dvh),1.125rem)]';
    case 'xl':
      return 'text-[clamp(1rem,min(5.13vw,2.37dvh),1.25rem)]';
    case '2xl':
      return 'text-[clamp(1.1875rem,min(6.15vw,2.84dvh),1.5rem)]';
    case '3xl':
      return 'text-[clamp(1.4375rem,min(7.69vw,3.55dvh),1.875rem)]';
    case 'base':
    default:
      return 'text-[clamp(0.8125rem,min(4.1vw,1.9dvh),1rem)]';
  }
}

export function getContentLineHeightClassName(lineHeightToken?: PromptoonLineHeightToken): string {
  switch (lineHeightToken ?? DEFAULT_CONTENT_LINE_HEIGHT) {
    case 'tight':
      return 'leading-tight';
    case 'relaxed':
      return 'leading-relaxed';
    case 'loose':
      return 'leading-loose';
    case 'normal':
    default:
      return 'leading-normal';
  }
}

export function getContentSpacingClassName(prefix: 'mt' | 'mb', spacingToken?: PromptoonSpacingToken): string {
  if (!spacingToken || spacingToken === 'none') {
    return '';
  }

  if (prefix === 'mt') {
    switch (spacingToken) {
      case 'sm':
        return 'mt-4';
      case 'base':
        return 'mt-8';
      case 'lg':
        return 'mt-16';
      case 'xl':
        return 'mt-32';
      case '2xl':
        return 'mt-48';
      case '3xl':
        return 'mt-64';
      case '4xl':
        return 'mt-[320px]';
      case '5xl':
        return 'mt-[384px]';
      case '6xl':
        return 'mt-[448px]';
      case '7xl':
        return 'mt-[512px]';
      case '8xl':
        return 'mt-[576px]';
      case '9xl':
        return 'mt-[640px]';
      case '10xl':
        return 'mt-[704px]';
      default:
        return '';
    }
  }

  switch (spacingToken) {
    case 'sm':
      return 'mb-4';
    case 'base':
      return 'mb-8';
    case 'lg':
      return 'mb-16';
    case 'xl':
      return 'mb-32';
    case '2xl':
      return 'mb-48';
    case '3xl':
      return 'mb-64';
    case '4xl':
      return 'mb-[320px]';
    case '5xl':
      return 'mb-[384px]';
    case '6xl':
      return 'mb-[448px]';
    case '7xl':
      return 'mb-[512px]';
    case '8xl':
      return 'mb-[576px]';
    case '9xl':
      return 'mb-[640px]';
    case '10xl':
      return 'mb-[704px]';
    default:
      return '';
  }
}

export function getContentSpacingMinHeight(spacingToken?: PromptoonSpacingToken): string | undefined {
  switch (spacingToken) {
    case 'sm':
      return '16px';
    case 'base':
      return '32px';
    case 'lg':
      return '64px';
    case 'xl':
      return '128px';
    case '2xl':
      return '192px';
    case '3xl':
      return '256px';
    case '4xl':
      return '320px';
    case '5xl':
      return '384px';
    case '6xl':
      return '448px';
    case '7xl':
      return '512px';
    case '8xl':
      return '576px';
    case '9xl':
      return '640px';
    case '10xl':
      return '704px';
    case 'none':
    default:
      return undefined;
  }
}

export function replaceContentBindings(text: string, bindings: ViewerBindings): string {
  return text.replaceAll('{{userName}}', bindings.userName.trim());
}

export function normalizeCutContentBlocks(cut: ContentRenderableCut): CutContentBlock[] {
  if (cut.contentBlocks && cut.contentBlocks.length > 0) {
    return cut.contentBlocks;
  }

  if (cut.body.trim().length === 0) {
    return [];
  }

  return [
    {
      id: `${cut.id}-legacy-body`,
      type: 'narration',
      text: cut.body,
      textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
      fontToken: DEFAULT_CONTENT_FONT_TOKEN,
      placement: 'flow'
    }
  ];
}

export function isTextContentBlock(
  block: CutContentBlock
): block is Extract<CutContentBlock, { type: 'heading' | 'narration' | 'quote' | 'emphasis' | 'dialogue' }> {
  return block.type === 'heading' || block.type === 'narration' || block.type === 'quote' || block.type === 'emphasis' || block.type === 'dialogue';
}

export function getContentBlockPlacement(block: CutContentBlock): PromptoonContentPlacement {
  return isTextContentBlock(block) ? (block.placement ?? 'flow') : 'flow';
}

export function getCutContentBlocksByPlacement(cut: ContentRenderableCut, placement: PromptoonContentPlacement): CutContentBlock[] {
  return normalizeCutContentBlocks(cut).filter((block) => getContentBlockPlacement(block) === placement);
}

export function deriveContentBlocksBody(contentBlocks: CutContentBlock[], fallback = ''): string {
  const derived = contentBlocks
    .flatMap((block) => {
      switch (block.type) {
        case 'heading':
        case 'narration':
        case 'emphasis':
        case 'dialogue':
          return [block.text.trim()];
        case 'quote':
          return [block.title?.trim() ?? '', block.text.trim()];
        case 'image':
        case 'nameInput':
          return [];
        default:
          return [];
      }
    })
    .filter((value) => value.length > 0)
    .join('\n\n')
    .trim();

  return derived.length > 0 ? derived : fallback;
}

function createBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

function createTextBlock<
  T extends
    | PromptoonHeadingContentBlock
    | PromptoonNarrationContentBlock
    | PromptoonQuoteContentBlock
    | PromptoonEmphasisContentBlock
    | {
        id: string;
        type: 'dialogue';
        text: string;
        textAlign: PromptoonContentTextAlign;
        fontToken: PromptoonFontToken;
        placement?: PromptoonContentPlacement;
        fontSizeToken?: PromptoonFontSizeToken;
        lineHeightToken?: PromptoonLineHeightToken;
        marginTopToken?: PromptoonSpacingToken;
        marginBottomToken?: PromptoonSpacingToken;
        speaker?: string;
      }
>(
  block: T
): T {
  return block;
}

export function createContentBlock(type: CutContentBlock['type']): CutContentBlock {
  switch (type) {
    case 'heading':
      return createTextBlock({
        id: createBlockId(),
        type,
        text: '',
        textAlign: 'center',
        fontToken: 'display',
        placement: 'flow',
        fontSizeToken: '2xl',
        speaker: ''
      });
    case 'dialogue':
      return createTextBlock({
        id: createBlockId(),
        type,
        text: '',
        speaker: '',
        textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
        fontToken: DEFAULT_CONTENT_FONT_TOKEN,
        placement: 'overlay',
        fontSizeToken: DEFAULT_CONTENT_FONT_SIZE
      });
    case 'quote':
      return createTextBlock({
        id: createBlockId(),
        type,
        title: '',
        text: '',
        textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
        fontToken: 'serif-kr',
        placement: 'flow',
        fontSizeToken: 'lg',
        speaker: ''
      });
    case 'emphasis':
      return createTextBlock({
        id: createBlockId(),
        type,
        text: '',
        textAlign: 'center',
        fontToken: 'serif-kr',
        placement: 'flow',
        fontSizeToken: 'xl',
        speaker: ''
      });
    case 'image':
      return {
        id: createBlockId(),
        type,
        assetUrl: null,
        alt: ''
      };
    case 'nameInput':
      return {
        id: createBlockId(),
        type,
        placeholder: '이름을 입력하세요',
        maxLength: DEFAULT_NAME_INPUT_MAX_LENGTH,
        required: true,
        bindingKey: 'userName'
      };
    case 'narration':
    default:
      return createTextBlock({
        id: createBlockId(),
        type: 'narration',
        text: '',
        textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
        fontToken: DEFAULT_CONTENT_FONT_TOKEN,
        placement: 'flow',
        fontSizeToken: DEFAULT_CONTENT_FONT_SIZE,
        speaker: ''
      });
  }
}
