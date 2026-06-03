import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

// db/client must be mocked before importing safeway so the safeway module's
// top-level binding picks up the mocked versions.
vi.mock('../../src/db/client', () => ({
  writeDeals: vi.fn().mockResolvedValue(undefined),
  writeCircular: vi.fn().mockResolvedValue(undefined),
  getCircular: vi.fn(),
  deleteCircularAndDeals: vi.fn(),
}));
vi.mock('../../src/scraper/products', () => ({
  findCanonicalProductId: vi.fn().mockReturnValue(undefined),
}));

import { extractWeeklyAds, fetchAndPersistWeeklyDeals, NoCircularError } from '../../src/scraper/safeway';
import { getCircular, deleteCircularAndDeals } from '../../src/db/client';

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

  // Regression for 2026-06-02 incident: Safeway/Flipp dropped the human-readable
  // `external_display_name` label on the preview circular, leaving it empty.
  // The fallback signals (flyer_type_id and name) must still identify it as a
  // weekly ad, otherwise the scheduled scrape silently misses it.
  it('picks up a preview circular whose external_display_name is empty', () => {
    const ads = extractWeeklyAds([
      // Current: full label still present
      pub({
        id: 7942088,
        external_display_name: 'Weekly Ad',
        name: 'Weekly Ad - Safeway - Denver',
        flyer_type_id: 10457,
        valid_from: '2026-05-27T00:00:00-04:00',
        valid_to: '2026-06-02T23:59:59-04:00',
      }),
      // Preview: external_display_name cleared, but flyer_type_id and name still identify it.
      pub({
        id: 7957959,
        external_display_name: '',
        name: 'Weekly Ad - Safeway - Denver',
        flyer_type_id: 10457,
        valid_from: '2026-06-03T00:00:00-04:00',
        valid_to: '2026-06-09T23:59:59-04:00',
      }),
    ]);
    expect(ads.map((a) => a.circularId)).toEqual(['7942088', '7957959']);
  });

  it('still excludes Big Book of Savings when only flyer_type_id is set (not 10457)', () => {
    // BBS in prod has flyer_type_id 10642 (not 10457) and a name that doesn't
    // start with "Weekly Ad". Verifies the broadened filter didn't over-match.
    const ads = extractWeeklyAds([
      pub({
        id: 7943049,
        external_display_name: 'Big Book of Savings',
        name: 'Safeway - Denver - BBS',
        flyer_type_id: 10642,
        valid_from: '2026-05-26T00:00:00-04:00',
        valid_to: '2026-06-22T23:59:59-04:00',
      }),
    ]);
    expect(ads).toEqual([]);
  });
});

// High-level wrapper that mirrors Kroger's fetchAndPersistWeeklyDeals.
// Tests focus on the orchestration logic (target selection, alreadyScraped
// short-circuit, force-delete). The intra-module calls (fetchPublications,
// fetchWeeklyDeals) can't be spied on under ESM, so we mock the global fetch
// to return canned Flipp responses — same pattern as kingsoopers.test.ts.
describe('fetchAndPersistWeeklyDeals (high-level)', () => {
  let fetchSpy: MockInstance<typeof global.fetch>;
  const identifiers = { type: 'safeway' as const, storeId: '3836', postalCode: '80230' };
  const TZ = 'America/Denver';
  // 2026-05-19T18:00:00Z = noon-ish MDT, today-in-Denver = 2026-05-19.
  const NOW = new Date('2026-05-19T18:00:00Z');

  function pubEntry(overrides: Partial<Pub>): Pub {
    return {
      id: 0,
      external_display_name: 'Weekly Ad',
      valid_from: '2026-05-13T00:00:00-04:00',
      valid_to: '2026-05-19T23:59:59-04:00',
      storefront_id: 1,
      ...overrides,
    } as Pub;
  }

  function mockResponse(body: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  // Wire fetch to return `publications` for the publications endpoint and an
  // empty product array for the /products endpoint (deals are irrelevant — the
  // tests assert on orchestration, not deal content).
  function stubFetch(publications: Pub[]) {
    fetchSpy.mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes('/publications/safeway')) return mockResponse(publications);
      if (url.includes('/products')) return mockResponse([]);
      throw new Error(`Unexpected fetch URL in test: ${url}`);
    });
  }

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(getCircular).mockReset().mockResolvedValue(null);
    vi.mocked(deleteCircularAndDeals).mockReset().mockResolvedValue({ deletedCount: 0 });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it('picks the preview (future-dated) ad when preview: true', async () => {
    stubFetch([
      pubEntry({ id: 1, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' }),
      pubEntry({ id: 2, valid_from: '2026-05-20T00:00:00-04:00', valid_to: '2026-05-26T23:59:59-04:00' }),
    ]);

    const result = await fetchAndPersistWeeklyDeals(identifiers, 'safeway:abc', TZ, { preview: true });

    expect(result.circularId).toBe('2');
    expect(result.alreadyScraped).toBe(false);
    expect(result.circularDates).toEqual({ startDate: '2026-05-20', endDate: '2026-05-26' });
    expect(result.weekId).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('picks the active (currently-running) ad when preview: false', async () => {
    stubFetch([
      pubEntry({ id: 1, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' }),
      pubEntry({ id: 2, valid_from: '2026-05-20T00:00:00-04:00', valid_to: '2026-05-26T23:59:59-04:00' }),
    ]);

    const result = await fetchAndPersistWeeklyDeals(identifiers, 'safeway:abc', TZ, { preview: false });
    expect(result.circularId).toBe('1');
  });

  it('returns alreadyScraped (no /products call) when the same circularId is already in DDB', async () => {
    stubFetch([pubEntry({ id: 1, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' })]);
    vi.mocked(getCircular).mockResolvedValue({ circularId: '1', dealCount: 42 } as any);

    const result = await fetchAndPersistWeeklyDeals(identifiers, 'safeway:abc', TZ, { preview: false });

    expect(result.alreadyScraped).toBe(true);
    expect(result.existingDealCount).toBe(42);
    // No deals fetch (we short-circuited) — only the publications call happened.
    const productsCalls = fetchSpy.mock.calls.filter(([u]) => u.toString().includes('/products'));
    expect(productsCalls).toHaveLength(0);
  });

  it('force: true re-scrapes and deletes the existing circular first', async () => {
    stubFetch([pubEntry({ id: 1, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' })]);
    vi.mocked(getCircular).mockResolvedValue({ circularId: '1', dealCount: 42 } as any);
    vi.mocked(deleteCircularAndDeals).mockResolvedValue({ deletedCount: 43 });

    const result = await fetchAndPersistWeeklyDeals(identifiers, 'safeway:abc', TZ, {
      preview: false,
      force: true,
    });

    expect(result.alreadyScraped).toBe(false);
    expect(result.deletedCount).toBe(43);
    expect(deleteCircularAndDeals).toHaveBeenCalledWith('safeway:abc', result.weekId);
  });

  it('throws NoCircularError when no preview ad is published yet', async () => {
    stubFetch([pubEntry({ id: 1, valid_from: '2026-05-13T00:00:00-04:00', valid_to: '2026-05-19T23:59:59-04:00' })]);

    await expect(
      fetchAndPersistWeeklyDeals(identifiers, 'safeway:abc', TZ, { preview: true })
    ).rejects.toBeInstanceOf(NoCircularError);
  });

  it('throws NoCircularError when no active ad covers today', async () => {
    stubFetch([pubEntry({ id: 1, valid_from: '2026-06-01T00:00:00-04:00', valid_to: '2026-06-07T23:59:59-04:00' })]);

    await expect(
      fetchAndPersistWeeklyDeals(identifiers, 'safeway:abc', TZ, { preview: false })
    ).rejects.toMatchObject({ name: 'NoCircularError', message: 'No active weekly ad circular found' });
  });
});
