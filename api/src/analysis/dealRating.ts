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
  // Filter out current week and records with no price
  const filtered = history.filter(
    (h) => h.weekId !== currentWeekId && h.priceNumber != null
  ) as (DealItem & { priceNumber: number })[];

  if (filtered.length < 2) {
    return null;
  }

  const prices = filtered.map((h) => h.priceNumber);
  const historicalAvg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const historicalMin = Math.min(...prices);
  const sampleSize = prices.length;
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
