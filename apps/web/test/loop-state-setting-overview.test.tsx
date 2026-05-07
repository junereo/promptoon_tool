import type { Choice, Cut } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoopStateSettingOverviewModal } from '../src/features/exit-loop-cut-graph/ui/LoopStateSettingOverviewModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

function buildChoice(id: string, cutId: string, overrides?: Partial<Choice>): Choice {
  return {
    id,
    cutId,
    label: `Choice ${id}`,
    orderIndex: 0,
    nextCutId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('LoopStateSettingOverviewModal', () => {
  it('shows existing loop state connections and opens the create flow with the selected anchor', () => {
    const onClose = vi.fn();
    const onCreateNew = vi.fn();
    const onDeleteGroup = vi.fn().mockResolvedValue(undefined);
    const onEditGroup = vi.fn();
    const onSelectCut = vi.fn();
    const intro = buildCut('intro', { title: 'Intro' });
    const stage = buildCut('stage-1', {
      kind: 'loopStage',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'hotel-loop-12345678',
        groupLabel: 'Hotel Loop',
        role: 'stageBase',
        stageIndex: 1,
        stageCount: 1,
        variantCutIds: ['variant-1'],
        exitLevelRequired: 5
      },
      title: 'Hotel Stage 01'
    });
    const variant = buildCut('variant-1', {
      kind: 'loopVariant',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'hotel-loop-12345678',
        groupLabel: 'Hotel Loop',
        role: 'stageVariant',
        stageIndex: 1,
        stageCount: 1,
        truth: 'real_anomaly',
        expectedChoice: 'back',
        baseCutId: stage.id,
        exitLevelRequired: 5
      },
      title: 'Hotel Variant 01'
    });
    const resultRouter = buildCut('router', {
      kind: 'stateRouter',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'hotel-loop-12345678',
        groupLabel: 'Hotel Loop',
        role: 'resultRouter',
        stageCount: 1,
        exitLevelRequired: 5
      },
      stateFallbackCutId: stage.id,
      stateRoutes: [
        {
          id: 'exit-route',
          conditions: [{ stateKey: 'exitLoop.hotel-loop-12345678.route', equals: 'exit' }],
          label: 'Exit',
          nextCutId: 'exit-cut'
        }
      ],
      title: 'Hotel Result Router'
    });
    const exitCut = buildCut('exit-cut', { title: 'Hotel Exit' });
    const choices = [
      buildChoice('enter-loop', intro.id, { label: 'Hotel Loop', nextCutId: stage.id }),
      buildChoice('finish-loop', stage.id, { label: '나아간다', nextCutId: resultRouter.id })
    ];

    render(
      <LoopStateSettingOverviewModal
        choices={choices}
        cuts={[intro, stage, variant, resultRouter, exitCut]}
        initialAnchorCutId={intro.id}
        isOpen
        onClose={onClose}
        onCreateNew={onCreateNew}
        onDeleteGroup={onDeleteGroup}
        onEditGroup={onEditGroup}
        onSelectCut={onSelectCut}
      />
    );

    expect(screen.getByText('LoopStateSetting State')).toBeTruthy();
    expect(screen.getByText('Hotel Loop')).toBeTruthy();
    expect(screen.getByText('새 LoopStateSetting 기본 진입 컷: Intro')).toBeTruthy();
    expect(screen.getByText('Intro')).toBeTruthy();
    expect(screen.getByText('Hotel Exit')).toBeTruthy();
    expect(screen.getByText(/exitLoop\.hotel-loop-12345678\.route = exit/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '+ LoopStateSetting' }));
    expect(onCreateNew).toHaveBeenCalledWith(intro.id);

    fireEvent.click(screen.getByRole('button', { name: 'Hotel Stage 01 Stage 1' }));
    expect(onSelectCut).toHaveBeenCalledWith(stage.id);
    expect(onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    expect(onEditGroup).toHaveBeenCalledWith('hotel-loop-12345678');
  });

  it('confirms and deletes a loop state setting group from the overview', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onClose = vi.fn();
    const onCreateNew = vi.fn();
    const onDeleteGroup = vi.fn().mockResolvedValue(undefined);
    const onEditGroup = vi.fn();
    const onSelectCut = vi.fn();
    const stage = buildCut('stage-1', {
      kind: 'loopStage',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'hotel-loop-12345678',
        groupLabel: 'Hotel Loop',
        role: 'stageBase',
        stageIndex: 1,
        stageCount: 1,
        variantCutIds: [],
        exitLevelRequired: 5
      },
      title: 'Hotel Stage 01'
    });
    const resultRouter = buildCut('router', {
      kind: 'stateRouter',
      loopMetadata: {
        kind: 'exitLoop',
        groupId: 'hotel-loop-12345678',
        groupLabel: 'Hotel Loop',
        role: 'resultRouter',
        stageCount: 1,
        exitLevelRequired: 5
      },
      title: 'Hotel Result Router'
    });

    render(
      <LoopStateSettingOverviewModal
        choices={[]}
        cuts={[stage, resultRouter]}
        initialAnchorCutId={null}
        isOpen
        onClose={onClose}
        onCreateNew={onCreateNew}
        onDeleteGroup={onDeleteGroup}
        onEditGroup={onEditGroup}
        onSelectCut={onSelectCut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Hotel Loop LoopStateSetting을 삭제할까요?'));
    await waitFor(() => {
      expect(onDeleteGroup).toHaveBeenCalledWith('hotel-loop-12345678');
    });
  });
});
