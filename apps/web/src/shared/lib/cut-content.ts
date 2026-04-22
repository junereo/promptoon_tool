import type {
  CutContentBlock,
  Cut,
  PromptoonContentPlacement,
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
): block is Extract<CutContentBlock, { type: 'heading' | 'narration' | 'quote' | 'emphasis' }> {
  return block.type === 'heading' || block.type === 'narration' || block.type === 'quote' || block.type === 'emphasis';
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

function createTextBlock<T extends PromptoonHeadingContentBlock | PromptoonNarrationContentBlock | PromptoonQuoteContentBlock | PromptoonEmphasisContentBlock>(
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
        placement: 'flow'
      });
    case 'quote':
      return createTextBlock({
        id: createBlockId(),
        type,
        title: '',
        text: '',
        textAlign: DEFAULT_CONTENT_TEXT_ALIGN,
        fontToken: 'serif-kr',
        placement: 'flow'
      });
    case 'emphasis':
      return createTextBlock({
        id: createBlockId(),
        type,
        text: '',
        textAlign: 'center',
        fontToken: 'serif-kr',
        placement: 'flow'
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
        placement: 'flow'
      });
  }
}
