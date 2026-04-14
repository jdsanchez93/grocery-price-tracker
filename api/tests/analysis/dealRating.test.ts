import { describe, it, expect } from 'vitest';
import { computeDealRating } from '../../src/analysis/dealRating';
import { DealItem } from '../../src/types/database';

function makeDeal(weekId: string, priceNumber: number | null): DealItem {
  return {
    PK: `STORE#test#WEEK#${weekId}`,
    SK: 'DEAL#abc',
    entityType: 'DEAL',
    dealId: 'abc',
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

  it('returns good when price is more than 10% below average', () => {
    // avg = 4.00, 10% below = 3.60
    const rating = computeDealRating(3.50, CURRENT_WEEK, BASE_HISTORY);
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

  it('returns null when fewer than 2 historical data points', () => {
    const oneRecord = [makeDeal('2026-W14', 4.00)];
    expect(computeDealRating(4.00, CURRENT_WEEK, oneRecord)).toBeNull();
    expect(computeDealRating(4.00, CURRENT_WEEK, [])).toBeNull();
  });

  it('excludes current week records from history', () => {
    const historyWithCurrentWeek = [
      makeDeal(CURRENT_WEEK, 1.00), // should be excluded
      ...BASE_HISTORY,
    ];
    const rating = computeDealRating(4.00, CURRENT_WEEK, historyWithCurrentWeek);
    // Should still compute from BASE_HISTORY only
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
