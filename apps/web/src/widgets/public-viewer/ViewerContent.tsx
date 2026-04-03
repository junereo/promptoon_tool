import type { PublishManifest } from '@promptoon/shared';
import { motion } from 'framer-motion';

import { buildCutEffectMotionCustom, cutEffectVariants } from '../../shared/lib/cut-effects';
import { ViewerCutCard } from './ViewerCutCard';

type ViewerCut = PublishManifest['cuts'][number];
type ViewerChoice = ViewerCut['choices'][number];

interface ViewerContentProps {
  animated?: boolean;
  canGoBack: boolean;
  compact?: boolean;
  cut: ViewerCut;
  isTerminal: boolean;
  onChoiceClick: (choice: ViewerChoice) => void;
  onReset: () => void;
  onUserNameChange: (value: string) => void;
  onShare?: () => void;
  pendingChoice: { choiceId: string; reactionText: string | null } | null;
  userName: string;
  visibleChoices: ViewerChoice[];
}

export function ViewerContent({
  animated = false,
  canGoBack,
  compact = false,
  cut,
  isTerminal,
  onChoiceClick,
  onReset,
  onUserNameChange,
  onShare,
  pendingChoice,
  userName,
  visibleChoices
}: ViewerContentProps) {
  const isEnding = cut.isEnding || cut.kind === 'ending';
  const content = (
    <ViewerCutCard
      canGoBack={canGoBack}
      compact={compact}
      cut={cut}
      onChoiceClick={onChoiceClick}
      onReset={onReset}
      onUserNameChange={onUserNameChange}
      onShare={onShare}
      pendingChoice={pendingChoice}
      showChoices={isTerminal && !isEnding}
      showEndingActions={isTerminal && isEnding}
      userName={userName}
      visibleChoices={visibleChoices}
    />
  );

  if (!animated) {
    return (
      <div
        className="w-full"
        data-cut-id={cut.id}
        data-end-effect={cut.endEffect ?? 'none'}
        data-start-effect={cut.startEffect ?? 'none'}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-hidden"
      data-active-cut-end-effect={cut.endEffect ?? 'none'}
      data-active-cut-id={cut.id}
      data-active-cut-start-effect={cut.startEffect ?? 'none'}
    >
      <motion.div
        animate="animate"
        className="w-full will-change-transform"
        custom={buildCutEffectMotionCustom(cut.startEffect, cut.endEffect, cut.startEffectDurationMs, cut.endEffectDurationMs)}
        data-cut-id={cut.id}
        data-end-effect={cut.endEffect ?? 'none'}
        data-start-effect={cut.startEffect ?? 'none'}
        exit="exit"
        initial="initial"
        key={cut.id}
        variants={cutEffectVariants}
      >
        {content}
      </motion.div>
    </div>
  );
}
