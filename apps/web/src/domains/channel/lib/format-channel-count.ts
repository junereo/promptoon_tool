export function formatChannelCount(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: value >= 10000 ? 1 : 0,
    notation: value >= 10000 ? 'compact' : 'standard'
  }).format(value);
}
