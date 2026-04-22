import { describe, expect, it } from 'vitest';

import {
  createContentBlock,
  deriveContentBlocksBody,
  getContentFontSizeClassName,
  getContentLineHeightClassName,
  getContentSpacingClassName
} from '../src/shared/lib/cut-content';

describe('cut-content helpers', () => {
  it('creates dialogue blocks with overlay defaults', () => {
    const block = createContentBlock('dialogue');

    expect(block).toMatchObject({
      type: 'dialogue',
      placement: 'overlay',
      fontSizeToken: 'base',
      textAlign: 'left',
      speaker: ''
    });
  });

  it('derives body text from dialogue blocks without speaker metadata', () => {
    const body = deriveContentBlocksBody(
      [
        {
          id: 'dialogue-1',
          type: 'dialogue',
          text: '대사 한 줄',
          speaker: 'A',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'overlay',
          fontSizeToken: 'lg'
        }
      ],
      ''
    );

    expect(body).toBe('대사 한 줄');
  });

  it('maps font size tokens to tailwind classes', () => {
    expect(getContentFontSizeClassName('sm')).toBe('text-sm');
    expect(getContentFontSizeClassName('base')).toBe('text-base');
    expect(getContentFontSizeClassName('3xl')).toBe('text-3xl');
  });

  it('maps text rhythm tokens to static tailwind classes', () => {
    expect(getContentLineHeightClassName('tight')).toBe('leading-tight');
    expect(getContentLineHeightClassName('loose')).toBe('leading-loose');
    expect(getContentSpacingClassName('mt', 'lg')).toBe('mt-16');
    expect(getContentSpacingClassName('mb', '3xl')).toBe('mb-64');
    expect(getContentSpacingClassName('mb', '10xl')).toBe('mb-[704px]');
    expect(getContentSpacingClassName('mb', 'none')).toBe('');
  });
});
