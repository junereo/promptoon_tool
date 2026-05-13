import type { Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoopStateSettingModal } from '../src/features/exit-loop-cut-graph/ui/LoopStateSettingModal';

afterEach(() => {
  cleanup();
});

function buildCut(id: string, overrides?: Partial<Cut>): Cut {
  return {
    id,
    episodeId: 'episode-1',
    kind: 'scene',
    title: `Cut ${id}`,
    body: '',
    contentBlocks: [],
    dialogAnchorX: 'left',
    dialogAnchorY: 'bottom',
    dialogOffsetX: 0,
    dialogOffsetY: 0,
    dialogTextAlign: 'left',
    startEffect: 'none',
    endEffect: 'none',
    startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
    endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
    assetUrl: null,
    positionX: 0,
    positionY: 0,
    orderIndex: 0,
    isStart: false,
    isEnding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('LoopStateSettingModal', () => {
  it('keeps edited fields and uploaded asset URLs when the parent rerenders while open', async () => {
    const cuts = [buildCut('intro', { title: 'Intro' })];
    const onClose = vi.fn();
    const onCreateLoopState = vi.fn().mockResolvedValue(undefined);
    const onUploadAsset = vi.fn().mockResolvedValue('/uploads/project/base.webp');
    const { rerender } = render(
      <LoopStateSettingModal
        cuts={cuts}
        initialAttachAfterCutId="intro"
        isCreating={false}
        isOpen
        onClose={onClose}
        onCreateLoopState={onCreateLoopState}
        onUploadAsset={onUploadAsset}
      />
    );

    fireEvent.change(screen.getByLabelText('그룹 이름'), { target: { value: 'Hotel Loop' } });
    fireEvent.change(screen.getByLabelText('스테이지 수'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('탈출 카운트'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Stage 1'), { target: { value: 'Hotel Stage 01' } });
    fireEvent.change(screen.getAllByLabelText('Base 파일 업로드')[0]!, {
      target: { files: [new File(['image'], 'base.png', { type: 'image/png' })] }
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('/uploads/project/base.webp')).toBeTruthy();
    });

    rerender(
      <LoopStateSettingModal
        cuts={[...cuts]}
        initialAttachAfterCutId="intro"
        isCreating={false}
        isOpen
        onClose={onClose}
        onCreateLoopState={onCreateLoopState}
        onUploadAsset={onUploadAsset}
      />
    );

    expect(screen.getByDisplayValue('Hotel Loop')).toBeTruthy();
    expect(screen.getByDisplayValue('2')).toBeTruthy();
    expect(screen.getByDisplayValue('7')).toBeTruthy();
    expect(screen.getByDisplayValue('Hotel Stage 01')).toBeTruthy();
    expect(screen.getByDisplayValue('/uploads/project/base.webp')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(onCreateLoopState).toHaveBeenCalledWith({
        attachAfterCutId: 'intro',
        continuationCutId: null,
        exitLevelRequired: 7,
        groupName: 'Hotel Loop',
        retryCutId: null,
        stages: [
          {
            baseAssetUrl: '/uploads/project/base.webp',
            spacerAssetUrl: null,
            title: 'Hotel Stage 01',
            variants: [
              {
                assetUrl: null,
                title: 'Stage 01 Variant 1',
                truth: 'real_anomaly'
              }
            ]
          },
          {
            baseAssetUrl: null,
            spacerAssetUrl: null,
            title: 'Stage 02',
            variants: [
              {
                assetUrl: null,
                title: 'Stage 02 Variant 1',
                truth: 'real_anomaly'
              }
            ]
          }
        ]
      });
    });
  });
});
