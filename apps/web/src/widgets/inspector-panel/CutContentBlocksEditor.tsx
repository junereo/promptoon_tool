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

function textStyleSelectClassName() {
  return 'w-full min-w-0 max-w-full rounded-lg border border-editor-border bg-black/20 px-2 py-1.5 text-xs text-zinc-100 outline-none transition focus:border-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60';
}

function inlineInputClassName() {
  return 'w-full rounded-2xl border border-transparent bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft focus:bg-black/20';
}

function ToolbarGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="w-full min-w-0 max-w-full rounded-xl border border-editor-border bg-black/10 p-2">
      <p className="text-[10px] font-semibold text-zinc-500">{title}</p>
      <div className="mt-1.5 grid gap-1.5">{children}</div>
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

function InlineSelectField<TValue extends string>({
  ariaLabel,
  disabled,
  id,
  label,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: TValue) => void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <div className="grid w-full max-w-full min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1.5">
      <label className="whitespace-nowrap text-right text-[11px] font-medium text-zinc-500" htmlFor={id}>
        {label} :
      </label>
      <select
        aria-label={ariaLabel}
        className={textStyleSelectClassName()}
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value as TValue)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
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
    <div className="w-full min-w-0 max-w-full rounded-xl border border-editor-border bg-black/10 p-2">
      <div className="flex min-w-0 max-w-full flex-col gap-2">
        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-500">텍스트 스타일</p>
          <p className="min-w-0 truncate text-[11px] text-zinc-400">
            {selectedBlock
              ? `${blockTitle(selectedBlock.type)} 블록 선택됨`
              : '텍스트 블록 없음'}
          </p>
        </div>

        <div className="inspector-style-grid grid w-full min-w-0 max-w-full gap-1.5">
          <ToolbarGroup title="배치">
            <div className="grid gap-1.5">
              <InlineSelectField
                ariaLabel="Block Align"
                disabled={disabled}
                id="text-style-align"
                label="정렬"
                onChange={onAlignChange}
                options={CONTENT_ALIGN_OPTIONS}
                value={selectedBlock?.textAlign ?? 'left'}
              />

              <InlineSelectField
                ariaLabel="Block Placement"
                disabled={disabled}
                id="text-style-placement"
                label="위치"
                onChange={onPlacementChange}
                options={CONTENT_PLACEMENT_OPTIONS}
                value={selectedBlock?.placement ?? 'flow'}
              />
            </div>
          </ToolbarGroup>

          <ToolbarGroup title="글자">
            <div className="grid gap-1.5">
              <InlineSelectField
                ariaLabel="Block Font"
                disabled={disabled}
                id="text-style-font"
                label="서체"
                onChange={onFontChange}
                options={CONTENT_FONT_OPTIONS}
                value={selectedBlock?.fontToken ?? 'sans-kr'}
              />

              <InlineSelectField
                ariaLabel="Block Font Size"
                disabled={disabled}
                id="text-style-font-size"
                label="크기"
                onChange={onFontSizeChange}
                options={CONTENT_FONT_SIZE_OPTIONS}
                value={selectedBlock?.fontSizeToken ?? DEFAULT_BLOCK_FONT_SIZE}
              />

              <InlineSelectField
                ariaLabel="Block Line Height"
                disabled={disabled}
                id="text-style-line-height"
                label="줄간격"
                onChange={onLineHeightChange}
                options={CONTENT_LINE_HEIGHT_OPTIONS}
                value={selectedBlock?.lineHeightToken ?? 'normal'}
              />
            </div>
          </ToolbarGroup>

          <ToolbarGroup title="간격">
            <div className="grid gap-1.5">
              <InlineSelectField
                ariaLabel="Block Top Spacing"
                disabled={disabled}
                id="text-style-margin-top"
                label="위 여백"
                onChange={onMarginTopChange}
                options={CONTENT_SPACING_OPTIONS}
                value={selectedBlock?.marginTopToken ?? 'none'}
              />

              <InlineSelectField
                ariaLabel="Block Bottom Spacing"
                disabled={disabled}
                id="text-style-margin-bottom"
                label="아래 여백"
                onChange={onMarginBottomChange}
                options={CONTENT_SPACING_OPTIONS}
                value={selectedBlock?.marginBottomToken ?? 'none'}
              />
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
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-editor-border" />
        <button
          aria-label="Insert block"
          className="inline-flex h-7 items-center justify-center rounded-full border border-editor-border bg-black/15 px-2.5 text-xs text-zinc-300 transition hover:border-editor-accentSoft hover:text-white"
          onClick={onToggle}
          type="button"
        >
          + 블록
        </button>
        <div className="h-px flex-1 bg-editor-border" />
      </div>

      {expanded ? (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
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
        'group rounded-[18px] border px-3 py-2.5 transition',
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
      <div className="flex gap-2">
        <button
          aria-label="Reorder block"
          className="mt-2 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full border border-editor-border bg-black/15 text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-200"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          ≡
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <select
                aria-label={`Block Type ${block.id}`}
                className="rounded-full border border-editor-border bg-black/20 px-3 py-1.5 text-xs text-zinc-200 outline-none transition focus:border-editor-accentSoft"
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
              삭제
            </button>
          </div>

          {isTextBlock(block) ? (
            <div className="mt-2 space-y-2">
              {block.type === 'dialogue' ? (
                <input
                  aria-label="Dialogue Speaker"
                  className={inlineInputClassName()}
                  onChange={(event) => onUpdateBlock((current) => (current.type === 'dialogue' ? { ...current, speaker: event.target.value } : current))}
                  onFocus={onFocusBlock}
                  placeholder="화자"
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
                  placeholder="인용 제목"
                  type="text"
                  value={block.title ?? ''}
                />
              ) : null}

              <textarea
                aria-label="Block Text"
                className={`${inlineInputClassName()} min-h-[72px] resize-y whitespace-pre-wrap`}
                onChange={(event) => onUpdateBlock((current) => ('text' in current ? { ...current, text: event.target.value } : current))}
                onFocus={onFocusBlock}
                placeholder={block.type === 'heading' ? '제목 문구' : block.type === 'dialogue' ? '대사 문구' : '블록 내용을 입력하세요'}
                value={block.text}
              />
            </div>
          ) : null}

          {block.type === 'image' ? (
            <div className="mt-2 space-y-2">
              {block.assetUrl ? (
                <div className="overflow-hidden rounded-2xl border border-editor-border bg-black/20">
                  <img alt={block.alt || '블록 이미지'} className="h-44 w-full object-cover" src={block.assetUrl} />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-editor-border bg-black/10 text-sm text-zinc-500">
                  {isUploading ? '이미지를 업로드하는 중입니다...' : '업로드된 이미지가 없습니다.'}
                </div>
              )}

              <div className="inspector-form-grid grid gap-2">
                <input
                  aria-label="Image Alt"
                  className={inlineInputClassName()}
                  onChange={(event) => onUpdateBlock((current) => (current.type === 'image' ? { ...current, alt: event.target.value } : current))}
                  onFocus={onFocusBlock}
                  placeholder="대체 텍스트"
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
            <div className="inspector-form-grid mt-2 grid gap-2">
              <input
                aria-label="Name Input Placeholder"
                className={inlineInputClassName()}
                onChange={(event) =>
                  onUpdateBlock((current) => (current.type === 'nameInput' ? { ...current, placeholder: event.target.value } : current))
                }
                onFocus={onFocusBlock}
                placeholder="입력 안내문"
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
                필수 입력
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
    <div className="inspector-card ml-auto w-[26rem] max-w-full min-w-0 rounded-2xl border border-editor-border bg-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-500">콘텐츠 블록</p>
        </div>

        <div className="grid w-full min-w-0 max-w-[9.5rem] grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-1.5">
          <label className="text-right text-xs font-medium text-zinc-500">보기 :</label>
          <select
            aria-label="View Style"
            className={textStyleSelectClassName()}
            onChange={(event) => onViewModeChange(event.target.value as 'default' | 'inverse')}
            value={viewMode}
          >
            <option value="default">기본</option>
            <option value="inverse">반전</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
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

      <div className="mt-3">
        {blocks.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-editor-border bg-black/10 px-4 py-5 text-center text-sm text-zinc-500">
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
