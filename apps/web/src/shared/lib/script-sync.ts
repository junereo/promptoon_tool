import type { Cut, CutContentBlock, PatchCutRequest } from '@promptoon/shared';

import { deriveContentBlocksBody, isTextContentBlock } from './cut-content';

export type ScriptEditableBlockType = Extract<CutContentBlock, { text: string }>['type'];

export interface ScriptBlockEdit {
  blockId: string;
  type: ScriptEditableBlockType;
  speaker?: string;
  text: string;
}

export interface ScriptCutEdit {
  cutId: string;
  cutTitle: string;
  blocks: ScriptBlockEdit[];
}

export type ScriptExportData = ScriptCutEdit[];

export interface ParseScriptResult {
  data: ScriptExportData | null;
  errors: string[];
  warnings: string[];
}

export interface ScriptCutPatch {
  cutId: string;
  patch: Pick<PatchCutRequest, 'body' | 'contentBlocks'>;
}

export interface BuildScriptPatchResult {
  patches: ScriptCutPatch[];
  warnings: string[];
}

const SCRIPT_BLOCK_TYPES: ScriptEditableBlockType[] = ['heading', 'narration', 'quote', 'emphasis', 'dialogue'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScriptBlockType(value: unknown): value is ScriptEditableBlockType {
  return typeof value === 'string' && SCRIPT_BLOCK_TYPES.includes(value as ScriptEditableBlockType);
}

function validateScriptData(value: unknown): ParseScriptResult {
  const errors: string[] = [];

  if (!Array.isArray(value)) {
    return {
      data: null,
      errors: ['Script JSON must be an array of cuts.'],
      warnings: []
    };
  }

  const data: ScriptExportData = [];

  value.forEach((cutValue, cutIndex) => {
    if (!isRecord(cutValue)) {
      errors.push(`Cut at index ${cutIndex} must be an object.`);
      return;
    }

    if (typeof cutValue.cutId !== 'string') {
      errors.push(`Cut at index ${cutIndex} is missing string cutId.`);
    }

    if (typeof cutValue.cutTitle !== 'string') {
      errors.push(`Cut at index ${cutIndex} is missing string cutTitle.`);
    }

    if (!Array.isArray(cutValue.blocks)) {
      errors.push(`Cut at index ${cutIndex} is missing blocks array.`);
      return;
    }

    const blocks: ScriptBlockEdit[] = [];

    cutValue.blocks.forEach((blockValue, blockIndex) => {
      if (!isRecord(blockValue)) {
        errors.push(`Block at cut ${cutIndex}, index ${blockIndex} must be an object.`);
        return;
      }

      if (typeof blockValue.blockId !== 'string') {
        errors.push(`Block at cut ${cutIndex}, index ${blockIndex} is missing string blockId.`);
      }

      if (!isScriptBlockType(blockValue.type)) {
        errors.push(`Block at cut ${cutIndex}, index ${blockIndex} has invalid type.`);
      }

      if (typeof blockValue.text !== 'string') {
        errors.push(`Block at cut ${cutIndex}, index ${blockIndex} is missing string text.`);
      }

      if (blockValue.speaker !== undefined && typeof blockValue.speaker !== 'string') {
        errors.push(`Block at cut ${cutIndex}, index ${blockIndex} has invalid speaker.`);
      }

      if (
        typeof blockValue.blockId === 'string' &&
        isScriptBlockType(blockValue.type) &&
        typeof blockValue.text === 'string' &&
        (blockValue.speaker === undefined || typeof blockValue.speaker === 'string')
      ) {
        blocks.push({
          blockId: blockValue.blockId,
          type: blockValue.type,
          speaker: blockValue.speaker,
          text: blockValue.text
        });
      }
    });

    if (typeof cutValue.cutId === 'string' && typeof cutValue.cutTitle === 'string') {
      data.push({
        cutId: cutValue.cutId,
        cutTitle: cutValue.cutTitle,
        blocks
      });
    }
  });

  return {
    data: errors.length > 0 ? null : data,
    errors,
    warnings: []
  };
}

export function parseScriptJson(text: string): ParseScriptResult {
  try {
    return validateScriptData(JSON.parse(text));
  } catch (error) {
    return {
      data: null,
      errors: [error instanceof Error ? error.message : 'Invalid JSON.'],
      warnings: []
    };
  }
}

export function exportCutsToScript(cuts: Cut[]): ScriptExportData {
  return cuts.map((cut) => ({
    cutId: cut.id,
    cutTitle: cut.title,
    blocks: (cut.contentBlocks ?? []).filter(isTextContentBlock).map((block) => ({
      blockId: block.id,
      type: block.type,
      speaker: block.type === 'dialogue' ? block.speaker : undefined,
      text: block.text
    }))
  }));
}

export function buildScriptPatch(cuts: Cut[], scriptData: ScriptExportData): BuildScriptPatchResult {
  const cutsById = new Map(cuts.map((cut) => [cut.id, cut]));
  const warnings: string[] = [];
  const patches: ScriptCutPatch[] = [];

  scriptData.forEach((scriptCut) => {
    const cut = cutsById.get(scriptCut.cutId);
    if (!cut) {
      warnings.push(`Unknown cutId skipped: ${scriptCut.cutId}`);
      return;
    }

    let didChange = false;
    const sourceBlocks = cut.contentBlocks ?? [];
    const scriptBlocksById = new Map(scriptCut.blocks.map((block) => [block.blockId, block]));
    const existingBlockIds = new Set(sourceBlocks.map((block) => block.id));

    scriptCut.blocks.forEach((scriptBlock) => {
      if (!existingBlockIds.has(scriptBlock.blockId)) {
        warnings.push(`Unknown blockId skipped in ${cut.title}: ${scriptBlock.blockId}`);
      }
    });

    const contentBlocks = sourceBlocks.map((block) => {
      const scriptBlock = scriptBlocksById.get(block.id);
      if (!scriptBlock || !isTextContentBlock(block)) {
        return block;
      }

      if (block.type !== scriptBlock.type) {
        warnings.push(`Type mismatch skipped for block ${block.id}: expected ${block.type}, received ${scriptBlock.type}`);
        return block;
      }

      if (block.type === 'dialogue') {
        const nextSpeaker = scriptBlock.speaker;
        if (block.text === scriptBlock.text && block.speaker === nextSpeaker) {
          return block;
        }

        didChange = true;
        return {
          ...block,
          text: scriptBlock.text,
          speaker: nextSpeaker
        };
      }

      if (block.text === scriptBlock.text) {
        return block;
      }

      didChange = true;
      return {
        ...block,
        text: scriptBlock.text
      };
    });

    if (didChange) {
      patches.push({
        cutId: cut.id,
        patch: {
          contentBlocks,
          body: deriveContentBlocksBody(contentBlocks, '')
        }
      });
    }
  });

  return {
    patches,
    warnings
  };
}
