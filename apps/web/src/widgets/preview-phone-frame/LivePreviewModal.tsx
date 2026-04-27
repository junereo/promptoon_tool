import type { Choice, Cut, PublishManifest } from '@promptoon/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ViewerCutCard } from '../public-viewer/ViewerCutCard';

type ViewerCut = PublishManifest['cuts'][number];
type DeviceOrientation = 'portrait' | 'landscape';

const DEVICE_PRESETS = [
  { borderRadius: 42, defaultOrientation: 'portrait', height: 852, id: 'iphone-15', label: 'iPhone 15', width: 393 },
  { borderRadius: 38, defaultOrientation: 'portrait', height: 854, id: 'galaxy-s24', label: 'Galaxy S24', width: 384 },
  { borderRadius: 30, defaultOrientation: 'portrait', height: 1180, id: 'ipad', label: 'iPad', width: 820 },
  { borderRadius: 18, defaultOrientation: 'landscape', height: 1440, id: 'desktop', label: 'Desktop', width: 900 }
] as const;

type DevicePresetId = (typeof DEVICE_PRESETS)[number]['id'];

function toViewerCut(cut: Cut, choices: Choice[]): ViewerCut {
  return {
    assetUrl: cut.assetUrl,
    body: cut.body,
    choices: choices.map((choice) => ({
      afterSelectReactionText: choice.afterSelectReactionText,
      id: choice.id,
      label: choice.label,
      nextCutId: choice.nextCutId,
      orderIndex: choice.orderIndex
    })),
    contentBlocks: cut.contentBlocks,
    contentViewMode: cut.contentViewMode,
    dialogAnchorX: cut.dialogAnchorX,
    dialogAnchorY: cut.dialogAnchorY,
    dialogOffsetX: cut.dialogOffsetX,
    dialogOffsetY: cut.dialogOffsetY,
    dialogTextAlign: cut.dialogTextAlign,
    edgeFade: cut.edgeFade,
    edgeFadeColor: cut.edgeFadeColor,
    edgeFadeIntensity: cut.edgeFadeIntensity,
    endEffect: cut.endEffect,
    endEffectDurationMs: cut.endEffectDurationMs,
    id: cut.id,
    isEnding: cut.isEnding,
    isStart: cut.isStart,
    kind: cut.kind,
    marginBottomToken: cut.marginBottomToken,
    orderIndex: cut.orderIndex,
    positionX: cut.positionX,
    positionY: cut.positionY,
    startEffect: cut.startEffect,
    startEffectDurationMs: cut.startEffectDurationMs,
    title: cut.title
  };
}

export function LivePreviewModal({
  currentChoices,
  currentCut,
  isOpen,
  nextChoices,
  nextCut,
  onClose,
  previousChoices,
  previousCut
}: {
  currentChoices: Choice[];
  currentCut: Cut | null;
  isOpen: boolean;
  nextChoices: Choice[];
  nextCut: Cut | null;
  onClose: () => void;
  previousChoices: Choice[];
  previousCut: Cut | null;
}) {
  const [userName, setUserName] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<DevicePresetId>('iphone-15');
  const [deviceOrientation, setDeviceOrientation] = useState<DeviceOrientation>('portrait');
  const [deviceScale, setDeviceScale] = useState(1);
  const deviceStageRef = useRef<HTMLDivElement | null>(null);
  const selectedDevice = useMemo(
    () => DEVICE_PRESETS.find((device) => device.id === selectedDeviceId) ?? DEVICE_PRESETS[0],
    [selectedDeviceId]
  );
  const deviceWidth = deviceOrientation === 'portrait' ? selectedDevice.width : selectedDevice.height;
  const deviceHeight = deviceOrientation === 'portrait' ? selectedDevice.height : selectedDevice.width;
  const viewerCuts = [
    previousCut ? toViewerCut(previousCut, previousChoices) : null,
    currentCut ? toViewerCut(currentCut, currentChoices) : null,
    nextCut ? toViewerCut(nextCut, nextChoices) : null
  ].filter((cut): cut is ViewerCut => Boolean(cut));
  const scalePercent = Math.round(deviceScale * 100);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setUserName('');
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const stageElement = deviceStageRef.current;
    if (!stageElement) {
      return;
    }

    const updateDeviceScale = () => {
      const stageRect = stageElement.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) {
        return;
      }

      const nextScale = Math.min(1, Math.max(0.2, (stageRect.width - 24) / deviceWidth, (stageRect.height - 24) / deviceHeight));
      setDeviceScale((current) => (Math.abs(current - nextScale) > 0.005 ? nextScale : current));
    };

    updateDeviceScale();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateDeviceScale();
    });
    resizeObserver.observe(stageElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [deviceHeight, deviceWidth, isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/78 px-4 py-4 text-white backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="live-preview-modal-title"
        aria-modal="true"
        className="relative flex h-[min(92dvh,58rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#101015] text-white shadow-2xl shadow-black/60"
        data-testid="live-preview-modal"
        role="dialog"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#18181d] via-[#111115] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(122,48,64,0.18),transparent_42%)]" />
        <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold text-white" id="live-preview-modal-title">
              Live Preview
            </p>
            <p className="mt-0.5 text-xs text-white/45">
              {selectedDevice.label} · {deviceWidth} x {deviceHeight} · {scalePercent}%
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <select
              aria-label="디바이스 선택"
              className="h-9 rounded-xl border border-white/10 bg-[#18181d] px-3 text-sm text-white outline-none transition focus:border-editor-accentSoft"
              data-testid="live-preview-device-select"
              onChange={(event) => {
                const nextDeviceId = event.target.value as DevicePresetId;
                const nextDevice = DEVICE_PRESETS.find((device) => device.id === nextDeviceId) ?? DEVICE_PRESETS[0];
                setSelectedDeviceId(nextDeviceId);
                setDeviceOrientation(nextDevice.defaultOrientation);
              }}
              value={selectedDeviceId}
            >
              {DEVICE_PRESETS.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </select>
            <div className="grid h-9 grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-black/35">
              <button
                aria-pressed={deviceOrientation === 'portrait'}
                className={[
                  'px-3 text-sm transition',
                  deviceOrientation === 'portrait' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                ].join(' ')}
                onClick={() => setDeviceOrientation('portrait')}
                type="button"
              >
                세로
              </button>
              <button
                aria-pressed={deviceOrientation === 'landscape'}
                className={[
                  'px-3 text-sm transition',
                  deviceOrientation === 'landscape' ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                ].join(' ')}
                onClick={() => setDeviceOrientation('landscape')}
                type="button"
              >
                가로
              </button>
            </div>
          </div>
          <button
            autoFocus
            className="rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3" ref={deviceStageRef}>
          <div
            className="relative shrink-0"
            style={{
              height: `${deviceHeight * deviceScale}px`,
              width: `${deviceWidth * deviceScale}px`
            }}
          >
            <div
              className="relative overflow-hidden border border-white/10 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.5)]"
              data-testid="live-preview-viewer-frame"
              style={{
                borderRadius: `${selectedDevice.borderRadius}px`,
                height: `${deviceHeight}px`,
                transform: `scale(${deviceScale})`,
                transformOrigin: 'top left',
                width: `${deviceWidth}px`
              }}
            >
              <div className="relative h-full w-full bg-[#101015]">
                <div
                  className="scrollbar-hidden relative z-10 h-full overflow-x-hidden overflow-y-auto"
                  data-testid="live-preview-viewer-scroll"
                >
                  <div className="w-full overflow-hidden" data-testid="live-preview-modal-panels">
                    {viewerCuts.length > 0 ? (
                      viewerCuts.map((viewerCut) => (
                        <ViewerCutCard
                          compact={viewerCuts.length > 1}
                          cut={viewerCut}
                          key={viewerCut.id}
                          onUserNameChange={setUserName}
                          showChoices={false}
                          showEndingActions={false}
                          userName={userName}
                          visibleChoices={[]}
                        />
                      ))
                    ) : (
                      <div className="flex min-h-full items-center justify-center px-6 text-center text-sm text-white/55">
                        표시할 컷이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
