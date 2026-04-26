import { DndContext, PointerSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import type {
  CutContentBlock,
  PromptoonContentPlacement,
  PromptoonContentTextAlign,
  PromptoonFontSizeToken,
  PromptoonFontToken,
  PromptoonLineHeightToken,
  PromptoonSpacingToken
} from '@promptoon/shared';
import { useEffect, useMemo, useState } from 'react';

import {
  CONTENT_ALIGN_OPTIONS,
  CONTENT_BLOCK_TYPE_OPTIONS,
  CONTENT_FONT_OPTIONS,
  CONTENT_FONT_SIZE_OPTIONS,
  CONTENT_LINE_HEIGHT_OPTIONS,
  CONTENT_PLACEMENT_OPTIONS,
  CONTENT_SPACING_OPTIONS,
  createContentBlock
} from '../../shared/lib/cut-content';

const DEFAULT_BLOCK_FONT_SIZE: PromptoonFontSizeToken = 'lg';

function inputClassName() {
  return 'mt-2 w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-center text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft';
}

function inlineInputClassName() {
  return 'w-full rounded-2xl border border-transparent bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft focus:bg-black/20';
}

function ToolbarGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-editor-border bg-black/10 p-3">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}

function insertBlockAt(blocks: CutContentBlock[], index: number, type: CutContentBlock['type']) {
  const nextBlocks = [...blocks];
  nextBlocks.splice(index, 0, createContentBlock(type));
  return nextBlocks;
}

function isTextBlock(block: CutContentBlock): block is Extract<CutContentBlock, { type: 'heading' | 'narration' | 'quote' | 'emphasis' | 'dialogue' }> {
  return block.type === 'heading' || block.type === 'narration' || block.type === 'quote' || block.type === 'emphasis' || block.type === 'dialogue';
}

function blockTitle(type: CutContentBlock['type']): string {
  const match = CONTENT_BLOCK_TYPE_OPTIONS.find((option) => option.value === type);
  return match?.label ?? type;
}

function convertBlockType(block: CutContentBlock, nextType: CutContentBlock['type']): CutContentBlock {
  if (block.type === nextType) {
    return block;
  }

  const preservedId = block.id;

  if (isTextBlock(block) && (nextType === 'heading' || nextType === 'narration' || nextType === 'quote' || nextType === 'emphasis' || nextType === 'dialogue')) {
    if (nextType === 'quote') {
      return {
        id: preservedId,
        type: 'quote',
        title: block.type === 'quote' ? block.title : '',
        text: block.text,
        textAlign: block.textAlign,
        fontToken: block.fontToken,
        placement: block.placement ?? 'flow',
        fontSizeToken: block.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE,
        lineHeightToken: block.lineHeightToken ?? 'normal',
        marginTopToken: block.marginTopToken ?? 'none',
        marginBottomToken: block.marginBottomToken ?? 'none',
        speaker: block.speaker ?? ''
      };
    }

    if (nextType === 'dialogue') {
      return {
        id: preservedId,
        type: 'dialogue',
        text: block.text,
        textAlign: block.textAlign,
        fontToken: block.fontToken,
        placement: block.placement ?? 'overlay',
        fontSizeToken: block.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE,
        lineHeightToken: block.lineHeightToken ?? 'normal',
        marginTopToken: block.marginTopToken ?? 'none',
        marginBottomToken: block.marginBottomToken ?? 'none',
        speaker: block.speaker ?? ''
      };
    }

    return {
      id: preservedId,
      type: nextType,
      text: block.text,
      textAlign: block.textAlign,
      fontToken: block.fontToken,
      placement: block.placement ?? 'flow',
      fontSizeToken: block.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE,
      lineHeightToken: block.lineHeightToken ?? 'normal',
      marginTopToken: block.marginTopToken ?? 'none',
      marginBottomToken: block.marginBottomToken ?? 'none',
      speaker: block.speaker ?? ''
    };
  }

  if (nextType === 'heading' || nextType === 'narration' || nextType === 'quote' || nextType === 'emphasis' || nextType === 'dialogue') {
    const defaultTextBlock = createContentBlock(nextType) as Extract<
      CutContentBlock,
      { type: 'heading' | 'narration' | 'quote' | 'emphasis' | 'dialogue' }
    >;

    if (nextType === 'quote') {
      return {
        id: preservedId,
        type: 'quote',
        title: '',
        text: '',
        textAlign: defaultTextBlock.textAlign,
        fontToken: defaultTextBlock.fontToken,
        placement: defaultTextBlock.placement ?? 'flow',
        fontSizeToken: defaultTextBlock.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE,
        lineHeightToken: defaultTextBlock.lineHeightToken ?? 'normal',
        marginTopToken: defaultTextBlock.marginTopToken ?? 'none',
        marginBottomToken: defaultTextBlock.marginBottomToken ?? 'none',
        speaker: defaultTextBlock.speaker ?? ''
      };
    }

    if (nextType === 'dialogue') {
      return {
        id: preservedId,
        type: 'dialogue',
        text: isTextBlock(block) ? block.text : '',
        textAlign: isTextBlock(block) ? block.textAlign : defaultTextBlock.textAlign,
        fontToken: isTextBlock(block) ? block.fontToken : defaultTextBlock.fontToken,
        placement: isTextBlock(block) ? (block.placement ?? 'overlay') : (defaultTextBlock.placement ?? 'overlay'),
        fontSizeToken: isTextBlock(block) ? (block.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE) : (defaultTextBlock.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE),
        lineHeightToken: isTextBlock(block) ? (block.lineHeightToken ?? 'normal') : (defaultTextBlock.lineHeightToken ?? 'normal'),
        marginTopToken: isTextBlock(block) ? (block.marginTopToken ?? 'none') : (defaultTextBlock.marginTopToken ?? 'none'),
        marginBottomToken: isTextBlock(block) ? (block.marginBottomToken ?? 'none') : (defaultTextBlock.marginBottomToken ?? 'none'),
        speaker: isTextBlock(block) ? block.speaker ?? '' : defaultTextBlock.speaker ?? ''
      };
    }

    return {
      id: preservedId,
      type: nextType,
      text: '',
      textAlign: defaultTextBlock.textAlign,
      fontToken: defaultTextBlock.fontToken,
      placement: defaultTextBlock.placement ?? 'flow',
      fontSizeToken: defaultTextBlock.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE,
      lineHeightToken: defaultTextBlock.lineHeightToken ?? 'normal',
      marginTopToken: defaultTextBlock.marginTopToken ?? 'none',
      marginBottomToken: defaultTextBlock.marginBottomToken ?? 'none',
      speaker: defaultTextBlock.speaker ?? ''
    };
  }

  if (nextType === 'image') {
    return {
      id: preservedId,
      type: 'image',
      assetUrl: block.type === 'image' ? block.assetUrl : null,
      alt: block.type === 'image' ? block.alt : ''
    };
  }

  const defaultNameInputBlock = createContentBlock('nameInput') as Extract<CutContentBlock, { type: 'nameInput' }>;

  return {
    id: preservedId,
    type: 'nameInput',
    placeholder: block.type === 'nameInput' ? block.placeholder : defaultNameInputBlock.placeholder,
    maxLength: block.type === 'nameInput' ? block.maxLength : defaultNameInputBlock.maxLength,
    required: block.type === 'nameInput' ? block.required : defaultNameInputBlock.required,
    bindingKey: 'userName'
  };
}

function updateBlockAt(blocks: CutContentBlock[], blockId: string, updater: (block: CutContentBlock) => CutContentBlock) {
  return blocks.map((block) => (block.id === blockId ? updater(block) : block));
}

function TextStyleToolbar({
  selectedBlock,
  onAlignChange,
  onFontChange,
  onLineHeightChange,
  onMarginBottomChange,
  onMarginTopChange,
  onFontSizeChange,
  onPlacementChange
}: {
  selectedBlock: Extract<CutContentBlock, { type: 'heading' | 'narration' | 'quote' | 'emphasis' | 'dialogue' }> | null;
  onAlignChange: (textAlign: PromptoonContentTextAlign) => void;
  onFontChange: (fontToken: PromptoonFontToken) => void;
  onLineHeightChange: (lineHeightToken: PromptoonLineHeightToken) => void;
  onMarginBottomChange: (spacingToken: PromptoonSpacingToken) => void;
  onMarginTopChange: (spacingToken: PromptoonSpacingToken) => void;
  onFontSizeChange: (fontSizeToken: PromptoonFontSizeToken) => void;
  onPlacementChange: (placement: PromptoonContentPlacement) => void;
}) {
  const disabled = selectedBlock === null;

  return (
    <div className="rounded-2xl border border-editor-border bg-black/10 p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-full max-w-md">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Text Style</p>
          <p className="mt-1 text-sm text-zinc-400">
            {selectedBlock
              ? `${blockTitle(selectedBlock.type)} block selected`
              : '텍스트 블록을 선택하면 Align / Font / Size / Placement / Spacing을 조정할 수 있습니다.'}
          </p>
        </div>

        <div className="grid w-full gap-3">
          <ToolbarGroup title="Layout">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Align</label>
                <select
                  aria-label="Block Align"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onAlignChange(event.target.value as PromptoonContentTextAlign)}
                  value={selectedBlock?.textAlign ?? 'left'}
                >
                  {CONTENT_ALIGN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Placement</label>
                <select
                  aria-label="Block Placement"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onPlacementChange(event.target.value as PromptoonContentPlacement)}
                  value={selectedBlock?.placement ?? 'flow'}
                >
                  {CONTENT_PLACEMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ToolbarGroup>

          <ToolbarGroup title="Typography">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Font</label>
                <select
                  aria-label="Block Font"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onFontChange(event.target.value as PromptoonFontToken)}
                  value={selectedBlock?.fontToken ?? 'sans-kr'}
                >
                  {CONTENT_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Size</label>
                <select
                  aria-label="Block Font Size"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onFontSizeChange(event.target.value as PromptoonFontSizeToken)}
                  value={selectedBlock?.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE}
                >
                  {CONTENT_FONT_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Line</label>
                <select
                  aria-label="Block Line Height"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onLineHeightChange(event.target.value as PromptoonLineHeightToken)}
                  value={selectedBlock?.lineHeightToken ?? 'normal'}
                >
                  {CONTENT_LINE_HEIGHT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ToolbarGroup>

          <ToolbarGroup title="Rhythm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Top</label>
                <select
                  aria-label="Block Top Spacing"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onMarginTopChange(event.target.value as PromptoonSpacingToken)}
                  value={selectedBlock?.marginTopToken ?? 'none'}
                >
                  {CONTENT_SPACING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Bottom</label>
                <select
                  aria-label="Block Bottom Spacing"
                  className={inputClassName()}
                  disabled={disabled}
                  onChange={(event) => onMarginBottomChange(event.target.value as PromptoonSpacingToken)}
                  value={selectedBlock?.marginBottomToken ?? 'none'}
                >
                  {CONTENT_SPACING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ToolbarGroup>
        </div>
      </div>
    </div>
  );
}

function InsertBlockLine({
  expanded,
  onToggle,
  onInsert
}: {
  expanded: boolean;
  onToggle: () => void;
  onInsert: (type: CutContentBlock['type']) => void;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-editor-border" />
        <button
          aria-label="Insert block"
          className="inline-flex h-8 items-center justify-center rounded-full border border-editor-border bg-black/15 px-3 text-sm text-zinc-300 transition hover:border-editor-accentSoft hover:text-white"
          onClick={onToggle}
          type="button"
        >
          + Block
        </button>
        <div className="h-px flex-1 bg-editor-border" />
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {CONTENT_BLOCK_TYPE_OPTIONS.map((option) => (
            <button
              className="rounded-full border border-editor-border bg-black/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-editor-accentSoft"
              key={option.value}
              onClick={() => onInsert(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortableBlockRow({
  block,
  isSelected,
  onDelete,
  onFocusBlock,
  onSelectBlock,
  onTypeChange,
  onUploadAsset,
  onUpdateBlock
}: {
  block: CutContentBlock;
  isSelected: boolean;
  onDelete: () => void;
  onFocusBlock: () => void;
  onSelectBlock: () => void;
  onTypeChange: (nextType: CutContentBlock['type']) => void;
  onUploadAsset: (file: File) => Promise<string>;
  onUpdateBlock: (updater: (block: CutContentBlock) => CutContentBlock) => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleImageUpload(file: File | null) {
    if (!file || block.type !== 'image') {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const assetUrl = await onUploadAsset(file);
      onUpdateBlock((current) => (current.type === 'image' ? { ...current, assetUrl } : current));
    } catch {
      setUploadError('이미지를 업로드하지 못했습니다.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div
      className={[
        'group rounded-[26px] border px-4 py-3 transition',
        isSelected ? 'border-editor-accentSoft bg-editor-panelAlt/70 shadow-[0_0_0_1px_rgba(122,48,64,0.18)]' : 'border-editor-border bg-editor-panelAlt/40 hover:border-zinc-600/70',
        isDragging ? 'opacity-70' : ''
      ].join(' ')}
      onClick={onSelectBlock}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
    >
      <div className="flex gap-3">
        <button
          aria-label="Reorder block"
          className="mt-3 inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-full border border-editor-border bg-black/15 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-200"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          ≡
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <select
                aria-label={`Block Type ${block.id}`}
                className="rounded-full border border-editor-border bg-black/20 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-zinc-200 outline-none transition focus:border-editor-accentSoft"
                onChange={(event) => onTypeChange(event.target.value as CutContentBlock['type'])}
                onFocus={onFocusBlock}
                value={block.type}
              >
                {CONTENT_BLOCK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">{blockTitle(block.type)}</span>
            </div>

            <button
              aria-label="Delete block"
              className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-200 transition hover:bg-red-500/20"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              type="button"
            >
              Delete
            </button>
          </div>

          {isTextBlock(block) ? (
            <div className="mt-3 space-y-3">
              {block.type === 'dialogue' ? (
                <input
                  aria-label="Dialogue Speaker"
                  className={inlineInputClassName()}
                  onChange={(event) => onUpdateBlock((current) => (current.type === 'dialogue' ? { ...current, speaker: event.target.value } : current))}
                  onFocus={onFocusBlock}
                  placeholder="Speaker"
                  type="text"
                  value={block.speaker ?? ''}
                />
              ) : null}

              {block.type === 'quote' ? (
                <input
                  aria-label="Quote Title"
                  className={inlineInputClassName()}
                  onChange={(event) => onUpdateBlock((current) => (current.type === 'quote' ? { ...current, title: event.target.value } : current))}
                  onFocus={onFocusBlock}
                  placeholder="Quote title"
                  type="text"
                  value={block.title ?? ''}
                />
              ) : null}

              <textarea
                aria-label="Block Text"
                className={`${inlineInputClassName()} min-h-[96px] resize-y whitespace-pre-wrap`}
                onChange={(event) => onUpdateBlock((current) => ('text' in current ? { ...current, text: event.target.value } : current))}
                onFocus={onFocusBlock}
                placeholder={block.type === 'heading' ? 'Heading text' : block.type === 'dialogue' ? 'Dialogue text' : 'Write a block...'}
                value={block.text}
              />
            </div>
          ) : null}

          {block.type === 'image' ? (
            <div className="mt-3 space-y-3">
              {block.assetUrl ? (
                <div className="overflow-hidden rounded-2xl border border-editor-border bg-black/20">
                  <img alt={block.alt || 'Block image'} className="h-44 w-full object-cover" src={block.assetUrl} />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-editor-border bg-black/10 text-sm text-zinc-500">
                  {isUploading ? '이미지를 업로드하는 중입니다...' : '업로드된 이미지가 없습니다.'}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  aria-label="Image Alt"
                  className={inlineInputClassName()}
                  onChange={(event) => onUpdateBlock((current) => (current.type === 'image' ? { ...current, alt: event.target.value } : current))}
                  onFocus={onFocusBlock}
                  placeholder="Alternative text"
                  type="text"
                  value={block.alt}
                />
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-editor-border bg-black/20 px-4 py-2 text-sm text-zinc-100 transition hover:border-editor-accentSoft">
                  {isUploading ? '업로드 중...' : '이미지 업로드'}
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleImageUpload(event.target.files?.[0] ?? null);
                      event.target.value = '';
                    }}
                    type="file"
                  />
                </label>
                {block.assetUrl ? (
                  <button
                    className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                    onClick={() => onUpdateBlock((current) => (current.type === 'image' ? { ...current, assetUrl: null } : current))}
                    type="button"
                  >
                    이미지 제거
                  </button>
                ) : null}
              </div>

              {uploadError ? <p className="text-xs text-red-300">{uploadError}</p> : null}
            </div>
          ) : null}

          {block.type === 'nameInput' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_0.8fr_auto]">
              <input
                aria-label="Name Input Placeholder"
                className={inlineInputClassName()}
                onChange={(event) =>
                  onUpdateBlock((current) => (current.type === 'nameInput' ? { ...current, placeholder: event.target.value } : current))
                }
                onFocus={onFocusBlock}
                placeholder="Placeholder"
                type="text"
                value={block.placeholder}
              />
              <input
                aria-label="Name Input Max Length"
                className={inlineInputClassName()}
                max={120}
                min={1}
                onChange={(event) =>
                  onUpdateBlock((current) =>
                    current.type === 'nameInput'
                      ? { ...current, maxLength: Math.min(120, Math.max(1, Number(event.target.value) || 1)) }
                      : current
                  )
                }
                onFocus={onFocusBlock}
                type="number"
                value={block.maxLength}
              />
              <label className="flex items-center gap-2 rounded-full border border-editor-border bg-black/15 px-4 py-2 text-sm text-zinc-300">
                <input
                  checked={block.required}
                  className="h-4 w-4 accent-editor-accentSoft"
                  onChange={(event) =>
                    onUpdateBlock((current) => (current.type === 'nameInput' ? { ...current, required: event.target.checked } : current))
                  }
                  onFocus={onFocusBlock}
                  type="checkbox"
                />
                Required
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CutContentBlocksEditor({
  blocks,
  onChange,
  onUploadAsset,
  viewMode,
  onViewModeChange
}: {
  blocks: CutContentBlock[];
  onChange: (blocks: CutContentBlock[]) => void;
  onUploadAsset: (file: File) => Promise<string>;
  viewMode: 'default' | 'inverse';
  onViewModeChange: (viewMode: 'default' | 'inverse') => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(blocks[0]?.id ?? null);
  const [expandedInsertIndex, setExpandedInsertIndex] = useState<number | null>(blocks.length === 0 ? 0 : null);

  useEffect(() => {
    if (blocks.length === 0) {
      setSelectedBlockId(null);
      setExpandedInsertIndex(0);
      return;
    }

    if (!selectedBlockId || !blocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(blocks[0].id);
    }

    setExpandedInsertIndex((current) => (current !== null && current > blocks.length ? blocks.length : current));
  }, [blocks, selectedBlockId]);

  const selectedTextBlock = useMemo(() => {
    const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? null;
    return selectedBlock && isTextBlock(selectedBlock) ? selectedBlock : null;
  }, [blocks, selectedBlockId]);

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    const oldIndex = blocks.findIndex((block) => block.id === event.active.id);
    const newIndex = blocks.findIndex((block) => block.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  function handleInsert(index: number, type: CutContentBlock['type']) {
    const nextBlocks = insertBlockAt(blocks, index, type);
    onChange(nextBlocks);
    setSelectedBlockId(nextBlocks[index]?.id ?? null);
    setExpandedInsertIndex(null);
  }

  function handleDelete(blockId: string) {
    const nextBlocks = blocks.filter((block) => block.id !== blockId);
    onChange(nextBlocks);

    if (selectedBlockId === blockId) {
      const deletedIndex = blocks.findIndex((block) => block.id === blockId);
      const fallbackBlock = nextBlocks[Math.max(0, deletedIndex - 1)] ?? nextBlocks[deletedIndex] ?? null;
      setSelectedBlockId(fallbackBlock?.id ?? null);
    }
  }

  function handleAlignChange(textAlign: PromptoonContentTextAlign) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, textAlign } : block)));
  }

  function handleFontChange(fontToken: PromptoonFontToken) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, fontToken } : block)));
  }

  function handleFontSizeChange(fontSizeToken: PromptoonFontSizeToken) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, fontSizeToken } : block)));
  }

  function handleLineHeightChange(lineHeightToken: PromptoonLineHeightToken) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, lineHeightToken } : block)));
  }

  function handleMarginTopChange(marginTopToken: PromptoonSpacingToken) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, marginTopToken } : block)));
  }

  function handleMarginBottomChange(marginBottomToken: PromptoonSpacingToken) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, marginBottomToken } : block)));
  }

  function handlePlacementChange(placement: PromptoonContentPlacement) {
    if (!selectedTextBlock) {
      return;
    }

    onChange(updateBlockAt(blocks, selectedTextBlock.id, (block) => (isTextBlock(block) ? { ...block, placement } : block)));
  }

  function handleTypeChange(blockId: string, nextType: CutContentBlock['type']) {
    onChange(updateBlockAt(blocks, blockId, (block) => convertBlockType(block, nextType)));
    setSelectedBlockId(blockId);
  }

  function handleBlockUpdate(blockId: string, updater: (block: CutContentBlock) => CutContentBlock) {
    onChange(updateBlockAt(blocks, blockId, updater));
  }

  return (
    <div className="rounded-2xl border border-editor-border bg-black/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Content Blocks</p>
          <p className="mt-2 text-sm text-zinc-400">블록을 인라인으로 편집하고, 드래그해서 순서를 바꿉니다.</p>
        </div>

        <div className="min-w-[180px]">
          <label className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">View Style</label>
          <select
            aria-label="View Style"
            className={inputClassName()}
            onChange={(event) => onViewModeChange(event.target.value as 'default' | 'inverse')}
            value={viewMode}
          >
            <option value="default">Default</option>
            <option value="inverse">Inverse</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <TextStyleToolbar
          onAlignChange={handleAlignChange}
          onFontChange={handleFontChange}
          onLineHeightChange={handleLineHeightChange}
          onMarginBottomChange={handleMarginBottomChange}
          onMarginTopChange={handleMarginTopChange}
          onFontSizeChange={handleFontSizeChange}
          onPlacementChange={handlePlacementChange}
          selectedBlock={selectedTextBlock}
        />
      </div>

      <div className="mt-5">
        {blocks.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-editor-border bg-black/10 px-5 py-8 text-center text-sm text-zinc-500">
            아직 블록이 없습니다. 아래 삽입 라인에서 첫 블록을 추가하세요.
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
            <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {blocks.map((block, index) => (
                  <div key={block.id}>
                    <InsertBlockLine
                      expanded={expandedInsertIndex === index}
                      onInsert={(type) => handleInsert(index, type)}
                      onToggle={() => setExpandedInsertIndex((current) => (current === index ? null : index))}
                    />
                    <SortableBlockRow
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      onDelete={() => handleDelete(block.id)}
                      onFocusBlock={() => setSelectedBlockId(block.id)}
                      onSelectBlock={() => setSelectedBlockId(block.id)}
                      onTypeChange={(nextType) => handleTypeChange(block.id, nextType)}
                      onUpdateBlock={(updater) => handleBlockUpdate(block.id, updater)}
                      onUploadAsset={onUploadAsset}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <InsertBlockLine
          expanded={expandedInsertIndex === blocks.length}
          onInsert={(type) => handleInsert(blocks.length, type)}
          onToggle={() => setExpandedInsertIndex((current) => (current === blocks.length ? null : blocks.length))}
        />
      </div>
    </div>
  );
}
