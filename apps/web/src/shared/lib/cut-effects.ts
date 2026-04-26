import type { PromptoonCutEffect, PromptoonEdgeFade, PromptoonEdgeFadeColor, PromptoonEdgeFadeIntensity } from '@promptoon/shared';
import type { CSSProperties } from 'react';
import type { Variants } from 'framer-motion';

export const DEFAULT_CUT_EFFECT: PromptoonCutEffect = 'none';
export const DEFAULT_CUT_EFFECT_DURATION_MS = 320;
export const MAX_CUT_EFFECT_DURATION_MS = 10000;

export const CUT_EFFECT_OPTIONS: Array<{ label: string; value: PromptoonCutEffect }> = [
  { label: 'None', value: 'none' },
  { label: 'Fade', value: 'fade' },
  { label: 'Slide Left', value: 'slide-left' },
  { label: 'Slide Right', value: 'slide-right' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Slide Down', value: 'slide-down' },
  { label: 'Zoom In', value: 'zoom-in' },
  { label: 'Zoom Out', value: 'zoom-out' }
];

export const EDGE_FADE_OPTIONS: Array<{ label: string; value: PromptoonEdgeFade }> = [
  { label: 'None', value: 'none' },
  { label: 'Top', value: 'top' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Both', value: 'both' }
];

export const EDGE_FADE_INTENSITY_OPTIONS: Array<{ label: string; value: PromptoonEdgeFadeIntensity }> = [
  { label: 'Minimal', value: 'minimal' },
  { label: 'Barely Soft', value: 'barely-soft' },
  { label: 'Ultra Soft', value: 'ultra-soft' },
  { label: 'Very Soft', value: 'very-soft' },
  { label: 'Soft', value: 'soft' },
  { label: 'Semi Soft', value: 'semi-soft' },
  { label: 'Normal', value: 'normal' },
  { label: 'Strong', value: 'strong' }
];

export const EDGE_FADE_COLOR_OPTIONS: Array<{ label: string; value: PromptoonEdgeFadeColor }> = [
  { label: 'Black', value: 'black' },
  { label: 'White', value: 'white' }
];

export const CUT_EFFECT_TRANSITION = {
  ease: [0.22, 1, 0.36, 1] as const
};

interface CutEffectMotionCustom {
  enterEffect?: PromptoonCutEffect | null;
  exitEffect?: PromptoonCutEffect | null;
  enterDurationMs?: number | null;
  exitDurationMs?: number | null;
}

function normalizeCutEffect(effect?: PromptoonCutEffect | null): PromptoonCutEffect {
  return effect ?? DEFAULT_CUT_EFFECT;
}

export function getCutEffectDurationMs(effect?: PromptoonCutEffect | null, durationMs?: number | null) {
  return normalizeCutEffect(effect) === 'none' ? 0 : (durationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS);
}

function getCutEffectTransition(effect?: PromptoonCutEffect | null, durationMs?: number | null) {
  return {
    ...CUT_EFFECT_TRANSITION,
    duration: getCutEffectDurationMs(effect, durationMs) / 1000
  };
}

function getEnterState(effect?: PromptoonCutEffect | null) {
  switch (normalizeCutEffect(effect)) {
    case 'fade':
      return { opacity: 0 };
    case 'slide-left':
      return { opacity: 0, x: -48 };
    case 'slide-right':
      return { opacity: 0, x: 48 };
    case 'slide-up':
      return { opacity: 0, y: -48 };
    case 'slide-down':
      return { opacity: 0, y: 48 };
    case 'zoom-in':
      return { opacity: 0, scale: 0.92 };
    case 'zoom-out':
      return { opacity: 0, scale: 1.08 };
    case 'none':
    default:
      return { opacity: 1, scale: 1, x: 0, y: 0 };
  }
}

function getExitState(effect?: PromptoonCutEffect | null) {
  switch (normalizeCutEffect(effect)) {
    case 'fade':
      return { opacity: 0 };
    case 'slide-left':
      return { opacity: 0, x: -48 };
    case 'slide-right':
      return { opacity: 0, x: 48 };
    case 'slide-up':
      return { opacity: 0, y: -48 };
    case 'slide-down':
      return { opacity: 0, y: 48 };
    case 'zoom-in':
      return { opacity: 0, scale: 1.08 };
    case 'zoom-out':
      return { opacity: 0, scale: 0.92 };
    case 'none':
    default:
      return { opacity: 1, scale: 1, x: 0, y: 0 };
  }
}

export const cutEffectVariants: Variants = {
  initial: ({ enterEffect }: CutEffectMotionCustom) => ({
    ...getEnterState(enterEffect)
  }),
  animate: ({ enterEffect, enterDurationMs }: CutEffectMotionCustom) => ({
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    transition: getCutEffectTransition(enterEffect, enterDurationMs)
  }),
  exit: ({ exitEffect, exitDurationMs }: CutEffectMotionCustom) => ({
    ...getExitState(exitEffect),
    transition: getCutEffectTransition(exitEffect, exitDurationMs)
  })
};

export function buildCutEffectMotionCustom(
  startEffect?: PromptoonCutEffect | null,
  endEffect?: PromptoonCutEffect | null,
  startEffectDurationMs?: number | null,
  endEffectDurationMs?: number | null
): CutEffectMotionCustom {
  return {
    enterEffect: normalizeCutEffect(startEffect),
    exitEffect: normalizeCutEffect(endEffect),
    enterDurationMs: startEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS,
    exitDurationMs: endEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS
  };
}

function getEdgeFadeStops(edgeFadeIntensity?: PromptoonEdgeFadeIntensity | null) {
  switch (edgeFadeIntensity ?? 'normal') {
    case 'minimal':
      return { topVisibleStart: 0.5, bottomVisibleEnd: 99.5 };
    case 'barely-soft':
      return { topVisibleStart: 1, bottomVisibleEnd: 99 };
    case 'ultra-soft':
      return { topVisibleStart: 3, bottomVisibleEnd: 97 };
    case 'very-soft':
      return { topVisibleStart: 5, bottomVisibleEnd: 95 };
    case 'soft':
      return { topVisibleStart: 8, bottomVisibleEnd: 92 };
    case 'semi-soft':
      return { topVisibleStart: 11, bottomVisibleEnd: 89 };
    case 'strong':
      return { topVisibleStart: 28, bottomVisibleEnd: 72 };
    case 'normal':
    default:
      return { topVisibleStart: 15, bottomVisibleEnd: 85 };
  }
}

function getEdgeFadeOverlayHeightClassName(edgeFadeIntensity?: PromptoonEdgeFadeIntensity | null): string {
  switch (edgeFadeIntensity ?? 'normal') {
    case 'minimal':
      return 'h-6';
    case 'barely-soft':
      return 'h-8';
    case 'ultra-soft':
      return 'h-10';
    case 'very-soft':
      return 'h-12';
    case 'soft':
      return 'h-16';
    case 'semi-soft':
      return 'h-20';
    case 'strong':
      return 'h-36';
    case 'normal':
    default:
      return 'h-24';
  }
}

export function getEdgeFadeStyle(edgeFade?: PromptoonEdgeFade | null, edgeFadeIntensity?: PromptoonEdgeFadeIntensity | null): CSSProperties {
  const stops = getEdgeFadeStops(edgeFadeIntensity);
  const maskImage = (() => {
    switch (edgeFade ?? 'none') {
      case 'top':
        return `linear-gradient(to bottom, transparent 0%, black ${stops.topVisibleStart}%, black 100%)`;
      case 'bottom':
        return `linear-gradient(to bottom, black 0%, black ${stops.bottomVisibleEnd}%, transparent 100%)`;
      case 'both':
        return `linear-gradient(to bottom, transparent 0%, black ${stops.topVisibleStart}%, black ${stops.bottomVisibleEnd}%, transparent 100%)`;
      case 'none':
      default:
        return null;
    }
  })();

  return maskImage ? { maskImage, WebkitMaskImage: maskImage } : {};
}

function getEdgeFadeOverlayColorClassName(edgeFadeColor?: PromptoonEdgeFadeColor | null): string {
  return (edgeFadeColor ?? 'black') === 'white' ? 'from-white' : 'from-[#101015]';
}

export function getEdgeFadeOverlayClassNames(
  edgeFade?: PromptoonEdgeFade | null,
  edgeFadeIntensity?: PromptoonEdgeFadeIntensity | null,
  edgeFadeColor?: PromptoonEdgeFadeColor | null
): string[] {
  const heightClassName = getEdgeFadeOverlayHeightClassName(edgeFadeIntensity);
  const colorClassName = getEdgeFadeOverlayColorClassName(edgeFadeColor);

  switch (edgeFade ?? 'none') {
    case 'top':
      return [`pointer-events-none absolute inset-x-0 top-0 z-[1] ${heightClassName} bg-gradient-to-b ${colorClassName} to-transparent`];
    case 'bottom':
      return [`pointer-events-none absolute inset-x-0 bottom-0 z-[1] ${heightClassName} bg-gradient-to-t ${colorClassName} to-transparent`];
    case 'both':
      return [
        `pointer-events-none absolute inset-x-0 top-0 z-[1] ${heightClassName} bg-gradient-to-b ${colorClassName} to-transparent`,
        `pointer-events-none absolute inset-x-0 bottom-0 z-[1] ${heightClassName} bg-gradient-to-t ${colorClassName} to-transparent`
      ];
    case 'none':
    default:
      return [];
  }
}
