import { describe, it, expect } from 'vitest';
import { computeDealRating } from '../../src/analysis/dealRating';
import { DealItem } from '../../src/types/database';

function makeDeal(weekId: string, priceNumber: number | null, dealId = 'abc'): DealItem {
  return {
    PK: `STORE#test#WEEK#${weekId}`,
    SK: `DEAL#${dealId}`,
    entityType: 'DEAL',
    dealId,
    storeInstanceId: 'kingsoopers:abc',
    weekId,
    name: 'Test Product',
    details: undefined,
    dept: 'produce',
    priceDisplay: priceNumber != null ? `$${priceNumber}` : 'N/A',
    priceNumber,
    quantity: 1,
    loyalty: undefined,
    image: undefined,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const CURRENT_WEEK = '2026-W15';

const BASE_HISTORY = [
  makeDeal('2026-W14', 4.00),
  makeDeal('2026-W13', 3.80),
  makeDeal('2026-W12', 4.20),
  makeDeal('2026-W11', 4.00),
];
// One record per week → 4 distinct weeks
// historicalAvg = (4.00 + 3.80 + 4.20 + 4.00) / 4 = 4.00
// historicalMin = 3.80

describe('computeDealRating', () => {
  it('returns best when price is at or below historicalMin * 1.02', () => {
    const rating = computeDealRating(3.80, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.label).toBe('best');
    expect(rating?.historicalMin).toBe(3.80);
    expect(rating?.sampleSize).toBe(4);
  });

  it('returns best when price is within 2% of historicalMin', () => {
    const rating = computeDealRating(3.875, CURRENT_WEEK, BASE_HISTORY);
    // 3.80 * 1.02 = 3.876
    expect(rating?.label).toBe('best');
  });

  it('returns good when price is more than 10% below average but above best threshold', () => {
    // Use history where min is well below avg so best and good ranges don't overlap:
    // prices: [3.00, 5.00, 5.00, 5.00] → avg=4.50, min=3.00
    // best threshold: 3.00 * 1.02 = 3.06
    // good threshold: 4.50 * 0.90 = 4.05
    // price 3.50: > 3.06 (not best), < 4.05 (good) ✓
    const history = [
      makeDeal('2026-W14', 3.00),
      makeDeal('2026-W13', 5.00),
      makeDeal('2026-W12', 5.00),
      makeDeal('2026-W11', 5.00),
    ];
    const rating = computeDealRating(3.50, CURRENT_WEEK, history);
    expect(rating?.label).toBe('good');
  });

  it('returns typical when price is within ±10% of average', () => {
    const rating = computeDealRating(4.00, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.label).toBe('typical');
  });

  it('returns typical for price just under 10% above average', () => {
    // avg = 4.00, 10% above = 4.40 (exclusive)
    const rating = computeDealRating(4.30, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.label).toBe('typical');
  });

  it('returns high when price is 10% or more above average', () => {
    // avg = 4.00, >= 4.40 = high
    const rating = computeDealRating(4.50, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.label).toBe('high');
  });

  it('returns null when fewer than 2 distinct historical weeks', () => {
    const oneWeek = [makeDeal('2026-W14', 4.00)];
    expect(computeDealRating(4.00, CURRENT_WEEK, oneWeek)).toBeNull();
    expect(computeDealRating(4.00, CURRENT_WEEK, [])).toBeNull();
  });

  it('excludes current week records from history', () => {
    const historyWithCurrentWeek = [
      makeDeal(CURRENT_WEEK, 1.00), // should be excluded
      ...BASE_HISTORY,
    ];
    const rating = computeDealRating(4.00, CURRENT_WEEK, historyWithCurrentWeek);
    expect(rating?.sampleSize).toBe(4);
    expect(rating?.historicalMin).toBe(3.80);
  });

  it('excludes records with null priceNumber', () => {
    const historyWithNulls = [
      makeDeal('2026-W10', null),
      makeDeal('2026-W09', null),
      ...BASE_HISTORY,
    ];
    const rating = computeDealRating(4.00, CURRENT_WEEK, historyWithNulls);
    expect(rating?.sampleSize).toBe(4);
  });

  it('returns null when all historical records have null price', () => {
    const nullHistory = [
      makeDeal('2026-W14', null),
      makeDeal('2026-W13', null),
      makeDeal('2026-W12', null),
    ];
    expect(computeDealRating(4.00, CURRENT_WEEK, nullHistory)).toBeNull();
  });

  it('deduplicates multiple deals in the same week, using the minimum price', () => {
    // Week W14 has 3 deals (e.g. Coca-Cola $3.50, Pepsi $4.00, 7up $3.80)
    // Week W13 has 1 deal
    const multiDealHistory = [
      makeDeal('2026-W14', 4.00, 'deal-1'),
      makeDeal('2026-W14', 3.50, 'deal-2'), // cheapest in W14
      makeDeal('2026-W14', 3.80, 'deal-3'),
      makeDeal('2026-W13', 4.00, 'deal-4'),
    ];
    // After dedup: W14 → 3.50, W13 → 4.00 → avg = 3.75, min = 3.50
    const rating = computeDealRating(4.00, CURRENT_WEEK, multiDealHistory);
    expect(rating?.sampleSize).toBe(2); // 2 distinct weeks, not 4 raw records
    expect(rating?.historicalMin).toBe(3.50);
    expect(rating?.historicalAvg).toBe(3.75);
  });

  it('returns null when multiple deals all belong to only 1 distinct week', () => {
    const singleWeek = [
      makeDeal('2026-W14', 3.50, 'deal-1'),
      makeDeal('2026-W14', 4.00, 'deal-2'),
      makeDeal('2026-W14', 3.80, 'deal-3'),
    ];
    expect(computeDealRating(4.00, CURRENT_WEEK, singleWeek)).toBeNull();
  });

  it('computes percentVsAvg correctly', () => {
    // avg = 4.00, price = 3.60 → (3.60 - 4.00) / 4.00 * 100 = -10%
    const rating = computeDealRating(3.60, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.percentVsAvg).toBe(-10);
  });

  it('computes positive percentVsAvg for above-average price', () => {
    // avg = 4.00, price = 4.40 → +10%
    const rating = computeDealRating(4.40, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.percentVsAvg).toBe(10);
  });

  it('returns historicalAvg and historicalMin', () => {
    const rating = computeDealRating(4.00, CURRENT_WEEK, BASE_HISTORY);
    expect(rating?.historicalAvg).toBe(4.00);
    expect(rating?.historicalMin).toBe(3.80);
  });
});
