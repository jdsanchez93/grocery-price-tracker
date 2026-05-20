import { describe, it, expect } from 'vitest';
import { extractWeeklyAds } from '../../src/scraper/safeway';

type Pub = Parameters<typeof extractWeeklyAds>[0][number];

function pub(overrides: Partial<Pub>): Pub {
  return {
    id: 0,
    external_display_name: 'Weekly Ad',
    valid_from: '2026-05-13T00:00:00-04:00',
    valid_to: '2026-05-19T23:59:59-04:00',
    storefront_id: 1,
    ...overrides,
  } as Pub;
}

describe('extractWeeklyAds', () => {
  it('returns an empty array when no Weekly Ad publications exist', () => {
    expect(
      extractWeeklyAds([
        pub({ id: 1, external_display_name: 'Big Book of Savings' }),
      ])
    ).toEqual([]);
  });

  it('filters out non-Weekly Ad publications (e.g. Big Book of Savings)', () => {
    const ads = extractWeeklyAds([
      pub({ id: 1, external_display_name: 'Weekly Ad', valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' }),
      pub({ id: 2, external_display_name: 'Big Book of Savings', valid_from: '2026-04-28T00:00:00-04:00', valid_to: '2026-05-25T23:59:59-04:00' }),
    ]);
    expect(ads).toHaveLength(1);
    expect(ads[0].circularId).toBe('1');
  });

  it('returns current and preview Weekly Ads sorted by startDate', () => {
    // Matches the production payload from the spec: current (May 13) + preview (May 20)
    const ads = extractWeeklyAds([
      pub({ id: 7929829, valid_from: '2026-05-20T00:00:00-04:00', valid_to: '2026-05-26T23:59:59-04:00' }),
      pub({ id: 7918444, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' }),
    ]);
    expect(ads).toEqual([
      { circularId: '7918444', startDate: '2026-05-13', endDate: '2026-05-19' },
      { circularId: '7929829', startDate: '2026-05-20', endDate: '2026-05-26' },
    ]);
  });

  it('strips the time/offset component (Flipp\'s offset is its server TZ, not the store\'s)', () => {
    // Denver store, but Flipp serializes valid_to as 23:59:59-04:00 (Eastern).
    // We only care about the calendar date; date-only comparison handles store-local correctly.
    const ads = extractWeeklyAds([
      pub({ id: 1, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' }),
    ]);
    expect(ads[0].startDate).toBe('2026-05-13');
    expect(ads[0].endDate).toBe('2026-05-19');
  });
});
