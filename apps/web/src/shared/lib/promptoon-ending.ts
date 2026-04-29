export function isPromptoonEndingCut(cut: { isEnding?: boolean; kind: string }): boolean {
  return Boolean(cut.isEnding) || cut.kind === 'ending' || cut.kind === 'resultCard';
}
