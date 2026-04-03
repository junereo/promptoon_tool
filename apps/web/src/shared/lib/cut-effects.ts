import type { PromptoonCutEffect } from '@promptoon/shared';
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
