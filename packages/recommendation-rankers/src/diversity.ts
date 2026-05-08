import type { RankedRecommendationItem } from './types';

export function applyProjectDiversity(items: RankedRecommendationItem[], limit: number): RankedRecommendationItem[] {
  const selected: RankedRecommendationItem[] = [];
  const overflow: RankedRecommendationItem[] = [];
  const selectedProjects = new Set<string>();

  for (const item of items) {
    if (selected.length >= limit) {
      break;
    }

    if (selectedProjects.has(item.projectId)) {
      overflow.push(item);
      continue;
    }

    selected.push(item);
    selectedProjects.add(item.projectId);
  }

  for (const item of overflow) {
    if (selected.length >= limit) {
      break;
    }

    selected.push(item);
  }

  return selected.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}
