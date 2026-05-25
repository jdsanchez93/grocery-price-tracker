import { DealItem } from '../types/database';

export interface DealRating {
  label: 'best' | 'good' | 'typical' | 'high';
  percentVsAvg: number;    // negative = below avg (good), positive = above avg
  historicalAvg: number;
  historicalMin: number;
  sampleSize: number;
}

export function computeDealRating(
  currentPrice: number,
  currentWeekId: string,
  history: DealItem[]
): DealRating | null {
  // Keep only strictly-past records with a price. WeekIds are zero-padded
  // "YYYY-Www" so lexical compare works both within a year and across year
  // boundaries (e.g. "2025-W52" < "2026-W01"). Using `<` (rather than `!==`)
  // excludes future-dated entries, which can appear when next week's circular
  // has been pre-scraped — those must not be counted as "history".
  const filtered = history.filter(
    (h) => h.weekId < currentWeekId && h.priceNumber != null
  ) as (DealItem & { priceNumber: number })[];

  // Collapse to one price per week (minimum) so sampleSize means "distinct weeks"
  // and stats aren't skewed by weeks with multiple matching deals
  const weekMinMap = new Map<string, number>();
  for (const item of filtered) {
    const existing = weekMinMap.get(item.weekId);
    if (existing === undefined || item.priceNumber < existing) {
      weekMinMap.set(item.weekId, item.priceNumber);
    }
  }

  // Require at least 2 distinct weeks of history
  if (weekMinMap.size < 2) {
    return null;
  }

  const prices = [...weekMinMap.values()];
  const historicalAvg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const historicalMin = Math.min(...prices);
  const sampleSize = weekMinMap.size; // distinct weeks
  const percentVsAvg = Math.round(((currentPrice - historicalAvg) / historicalAvg) * 100);

  let label: DealRating['label'];
  if (currentPrice <= historicalMin * 1.02) {
    label = 'best';
  } else if (currentPrice < historicalAvg * 0.90) {
    label = 'good';
  } else if (currentPrice < historicalAvg * 1.10) {
    label = 'typical';
  } else {
    label = 'high';
  }

  return { label, percentVsAvg, historicalAvg, historicalMin, sampleSize };
}
