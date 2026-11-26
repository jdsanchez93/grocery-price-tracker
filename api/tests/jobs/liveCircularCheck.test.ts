import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/db/client', () => ({
  getAllStores: vi.fn(),
  getStoreInstance: vi.fn(),
  getCircular: vi.fn(),
}));

// Keep the real date-range pickers (pickLiveCircular, extractWeeklyAds,
// selectWeeklyAd); mock only the network calls and the full scrape.
vi.mock('../../src/scraper/kingsoopers', async () => {
  const actual = await vi.importActual<typeof import('../../src/scraper/kingsoopers')>('../../src/scraper/kingsoopers');
  return {
    ...actual,
    fetchCircularsList: vi.fn(),
    fetchAndPersistWeeklyDeals: vi.fn(),
  };
});

vi.mock('../../src/scraper/safeway', async () => {
  const actual = await vi.importActual<typeof import('../../src/scraper/safeway')>('../../src/scraper/safeway');
  return {
    ...actual,
    fetchPublications: vi.fn(),
    fetchAndPersistWeeklyDeals: vi.fn(),
  };
});

import { runLiveCircularCheck, handler } from '../../src/jobs/liveCircularCheck';
import { getAllStores, getStoreInstance, getCircular } from '../../src/db/client';
import {
  fetchCircularsList,
  fetchAndPersistWeeklyDeals as ksFetchAndPersist,
  type CircularSummary,
} from '../../src/scraper/kingsoopers';
import {
  fetchPublications as sfwFetchPublications,
  fetchAndPersistWeeklyDeals as sfwFetchAndPersist,
} from '../../src/scraper/safeway';
import { NoCircularError } from '../../src/scraper/errors';
import { logger } from '../../src/logger';
import type { CircularItem, StoreInstanceItem } from '../../src/types/database';

// ── fixtures ─────────────────────────────────────────────────────────────────

function makeStore(overrides: Partial<StoreInstanceItem> = {}): StoreInstanceItem {
  return {
    PK: 'STOREINSTANCE#kingsoopers:abc',
    SK: 'METADATA',
    entityType: 'STORE_INSTANCE',
    instanceId: 'kingsoopers:abc',
    storeType: 'kingsoopers',
    name: 'King Soopers Test',
    identifiers: { type: 'kingsoopers', storeId: '12345', facilityId: '67890' },
    enabled: true,
    timezone: 'America/Denver',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const KS_STORE = makeStore();
const SFW_STORE = makeStore({
  PK: 'STOREINSTANCE#safeway:xyz',
  instanceId: 'safeway:xyz',
  storeType: 'safeway',
  name: 'Safeway Test',
  identifiers: { type: 'safeway', storeId: '3836', postalCode: '80230' },
});

function storedCircular(instanceId: string, weekId: string, circularId: string): CircularItem {
  return {
    PK: `STORE#${instanceId}#WEEK#${weekId}`,
    SK: 'METADATA',
    entityType: 'CIRCULAR',
    storeInstanceId: instanceId,
    weekId,
    circularId,
    startDate: '2026-11-27',
    endDate: '2026-12-01',
    dealCount: 42,
    createdAt: '2026-11-24T20:00:00Z',
    updatedAt: '2026-11-24T20:00:00Z',
  };
}

// Thanksgiving 2026, as Kroger's circulars list reports it (UTC instants of
// Mountain-time midnights). The holiday ad ran Wed Nov 18 → Thu Nov 26 (W47);
// the next ad runs Fri Nov 27 → Tue Dec 1 (W48).
const KS_HOLIDAY: CircularSummary = {
  circularId: 'ks-holiday',
  previewCircular: false,
  startDate: '2026-11-18T07:00:00Z',
  endDate: '2026-11-27T06:59:59Z',
  timezone: 'America/Denver',
};
const KS_POST_HOLIDAY: CircularSummary = {
  circularId: 'ks-post-holiday',
  previewCircular: true,
  startDate: '2026-11-27T07:00:00Z',
  endDate: '2026-12-02T06:59:59Z',
  timezone: 'America/Denver',
};

// Flipp publications for the same week (Flipp reports in its own server TZ).
function flippPub(id: number, validFrom: string, validTo: string) {
  return {
    id,
    external_display_name: '',
    name: 'Weekly Ad - Safeway - Denver',
    flyer_type_id: 10457,
    valid_from: validFrom,
    valid_to: validTo,
    storefront_id: 1,
  };
}
const SFW_HOLIDAY = flippPub(100, '2026-11-18T00:00:00-05:00', '2026-11-26T23:59:59-05:00');
const SFW_POST_HOLIDAY = flippPub(200, '2026-11-27T00:00:00-05:00', '2026-12-01T23:59:59-05:00');

function mockSafewayPublications(pubs: ReturnType<typeof flippPub>[]) {
  vi.mocked(sfwFetchPublications).mockResolvedValue({ weeklyAdPublicationId: null, publications: pubs });
}

function persistResult(circularId: string, weekId: string, dealCount: number) {
  return {
    deals: Array.from({ length: dealCount }, (_, i) => ({ name: `deal ${i}` })) as any,
    persisted: dealCount > 0,
    alreadyScraped: false,
    circularId,
    circularDates: { startDate: '2026-11-27', endDate: '2026-12-01' },
    weekId,
  };
}

// 00:30 MST on Fri 2026-11-27: the first scheduled run after the post-holiday ads start.
const FRI_NOV_27_0030_MST = new Date('2026-11-27T07:30:00Z');
// 09:00 MST on Wed 2026-11-25: the holiday ad is still live, the next one is pre-scraped.
const WED_NOV_25_0900_MST = new Date('2026-11-25T16:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FRI_NOV_27_0030_MST);
  vi.mocked(getAllStores).mockReset();
  vi.mocked(getStoreInstance).mockReset();
  vi.mocked(getCircular).mockReset().mockResolvedValue(null);
  vi.mocked(fetchCircularsList).mockReset();
  vi.mocked(ksFetchAndPersist).mockReset();
  vi.mocked(sfwFetchPublications).mockReset();
  vi.mocked(sfwFetchAndPersist).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('runLiveCircularCheck — store already scraped', () => {
  it('Kroger: no full scrape when the ad covering today is stored', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_HOLIDAY, KS_POST_HOLIDAY]);
    vi.mocked(getCircular).mockResolvedValue(storedCircular(KS_STORE.instanceId, '2026-W48', 'ks-post-holiday'));

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'already_scraped', circularId: 'ks-post-holiday', weekId: '2026-W48' },
    ]);
    expect(fetchCircularsList).toHaveBeenCalledWith(KS_STORE.identifiers);
    expect(getCircular).toHaveBeenCalledWith(KS_STORE.instanceId, '2026-W48');
    expect(ksFetchAndPersist).not.toHaveBeenCalled();
  });

  it('Safeway: no full scrape when the ad covering today is stored', async () => {
    vi.mocked(getAllStores).mockResolvedValue([SFW_STORE]);
    mockSafewayPublications([SFW_HOLIDAY, SFW_POST_HOLIDAY]);
    vi.mocked(getCircular).mockResolvedValue(storedCircular(SFW_STORE.instanceId, '2026-W48', '200'));

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: SFW_STORE.instanceId, result: 'already_scraped', circularId: '200', weekId: '2026-W48' },
    ]);
    expect(sfwFetchAndPersist).not.toHaveBeenCalled();
  });

  it('looks in the live ad\'s own partition, not today\'s weekId (holiday ad running past Tuesday)', async () => {
    // Wed Nov 25 is in the W48 window, but the live holiday ad started Nov 18
    // and is stored under W47. W48 holds the pre-scraped post-holiday ad.
    vi.setSystemTime(WED_NOV_25_0900_MST);
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_HOLIDAY, KS_POST_HOLIDAY]);
    vi.mocked(getCircular).mockImplementation(async (id, weekId) => {
      if (weekId === '2026-W47') return storedCircular(id, weekId, 'ks-holiday');
      if (weekId === '2026-W48') return storedCircular(id, weekId, 'ks-post-holiday');
      return null;
    });

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'already_scraped', circularId: 'ks-holiday', weekId: '2026-W47' },
    ]);
    expect(getCircular).toHaveBeenCalledTimes(1);
    expect(getCircular).toHaveBeenCalledWith(KS_STORE.instanceId, '2026-W47');
    expect(ksFetchAndPersist).not.toHaveBeenCalled();
  });
});

describe('runLiveCircularCheck — store missing its live ad', () => {
  it('Safeway: scrapes the post-Thanksgiving ad the Tuesday preview run missed', async () => {
    vi.mocked(getAllStores).mockResolvedValue([SFW_STORE]);
    mockSafewayPublications([SFW_HOLIDAY, SFW_POST_HOLIDAY]);
    vi.mocked(sfwFetchAndPersist).mockResolvedValue(persistResult('200', '2026-W48', 5));

    const report = await runLiveCircularCheck();

    expect(getCircular).toHaveBeenCalledWith(SFW_STORE.instanceId, '2026-W48');
    // No preview option: the canonical path selects the ad covering today.
    expect(sfwFetchAndPersist).toHaveBeenCalledTimes(1);
    expect(sfwFetchAndPersist).toHaveBeenCalledWith(SFW_STORE.identifiers, SFW_STORE.instanceId, 'America/Denver');
    expect(report.results).toEqual([
      { instanceId: SFW_STORE.instanceId, result: 'scraped', circularId: '200', weekId: '2026-W48', dealCount: 5, persisted: true },
    ]);
  });

  it('Kroger: scrapes the live ad with its own preview flag when Kroger still lists it as the preview', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_HOLIDAY, KS_POST_HOLIDAY]);
    vi.mocked(ksFetchAndPersist).mockResolvedValue(persistResult('ks-post-holiday', '2026-W48', 3));

    const report = await runLiveCircularCheck();

    expect(ksFetchAndPersist).toHaveBeenCalledTimes(1);
    expect(ksFetchAndPersist).toHaveBeenCalledWith(KS_STORE.identifiers, KS_STORE.instanceId, { preview: true });
    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'scraped', circularId: 'ks-post-holiday', weekId: '2026-W48', dealCount: 3, persisted: true },
    ]);
  });

  it('Kroger: scrapes with preview: false once Kroger lists the live ad as current', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([{ ...KS_POST_HOLIDAY, previewCircular: false }]);
    vi.mocked(ksFetchAndPersist).mockResolvedValue(persistResult('ks-post-holiday', '2026-W48', 3));

    await runLiveCircularCheck();

    expect(ksFetchAndPersist).toHaveBeenCalledWith(KS_STORE.identifiers, KS_STORE.instanceId, { preview: false });
  });

  it('dryRun reports would_scrape and writes nothing', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE, SFW_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_HOLIDAY, KS_POST_HOLIDAY]);
    mockSafewayPublications([SFW_HOLIDAY, SFW_POST_HOLIDAY]);

    const report = await runLiveCircularCheck({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'would_scrape', circularId: 'ks-post-holiday', weekId: '2026-W48', startDate: '2026-11-27', endDate: '2026-12-01' },
      { instanceId: SFW_STORE.instanceId, result: 'would_scrape', circularId: '200', weekId: '2026-W48', startDate: '2026-11-27', endDate: '2026-12-01' },
    ]);
    expect(ksFetchAndPersist).not.toHaveBeenCalled();
    expect(sfwFetchAndPersist).not.toHaveBeenCalled();
  });

  it('reports already_scraped when another writer stored the ad between peek and scrape', async () => {
    vi.mocked(getAllStores).mockResolvedValue([SFW_STORE]);
    mockSafewayPublications([SFW_POST_HOLIDAY]);
    vi.mocked(sfwFetchAndPersist).mockResolvedValue({ ...persistResult('200', '2026-W48', 0), alreadyScraped: true });

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: SFW_STORE.instanceId, result: 'already_scraped', circularId: '200', weekId: '2026-W48' },
    ]);
  });

  it('does not scrape when the live ad\'s partition holds a different circular', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_POST_HOLIDAY]);
    vi.mocked(getCircular).mockResolvedValue(storedCircular(KS_STORE.instanceId, '2026-W48', 'some-other-ad'));
    const warn = vi.spyOn(logger, 'warn');

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      {
        instanceId: KS_STORE.instanceId,
        result: 'partition_conflict',
        circularId: 'ks-post-holiday',
        weekId: '2026-W48',
        storedCircularId: 'some-other-ad',
      },
    ]);
    expect(ksFetchAndPersist).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: KS_STORE.instanceId, storedCircularId: 'some-other-ad' }),
      expect.stringContaining('partition holds a different circular'),
    );
  });
});

describe('runLiveCircularCheck — no ad upstream', () => {
  it('Kroger: logs and returns no_live_ad when nothing covers today', async () => {
    // Fri Nov 27, but upstream only lists the ad that ended Thu Nov 26.
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_HOLIDAY]);
    const info = vi.spyOn(logger, 'info');

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'no_live_ad', message: 'No ad covering today upstream' },
    ]);
    expect(getCircular).not.toHaveBeenCalled();
    expect(ksFetchAndPersist).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith({ instanceId: KS_STORE.instanceId }, 'live check: no ad covering today upstream');
  });

  it('Safeway: logs and returns no_live_ad when Flipp has no weekly ad covering today', async () => {
    vi.mocked(getAllStores).mockResolvedValue([SFW_STORE]);
    mockSafewayPublications([SFW_HOLIDAY]);

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: SFW_STORE.instanceId, result: 'no_live_ad', message: 'No ad covering today upstream' },
    ]);
    expect(sfwFetchAndPersist).not.toHaveBeenCalled();
  });

  it('treats NoCircularError from the scrape itself as no_live_ad, not a failure', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([KS_POST_HOLIDAY]);
    vi.mocked(ksFetchAndPersist).mockRejectedValue(new NoCircularError('No preview weekly ad circular found'));

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'no_live_ad', message: 'No preview weekly ad circular found' },
    ]);
  });

  it('the Lambda handler resolves (does not throw) when no ad is upstream', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE, SFW_STORE]);
    vi.mocked(fetchCircularsList).mockResolvedValue([]);
    mockSafewayPublications([]);

    const report = await handler(undefined, {} as any, () => {});

    expect(report!.results.map((r) => r.result)).toEqual(['no_live_ad', 'no_live_ad']);
  });
});

describe('runLiveCircularCheck — store selection and failures', () => {
  it('skips disabled and sprouts stores without any upstream call', async () => {
    vi.mocked(getAllStores).mockResolvedValue([
      makeStore({ instanceId: 'kingsoopers:off', enabled: false }),
      makeStore({ instanceId: 'sprouts:1', storeType: 'sprouts', identifiers: { type: 'sprouts', storeId: '1' } }),
    ]);

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: 'kingsoopers:off', result: 'skipped', reason: 'disabled' },
      { instanceId: 'sprouts:1', result: 'skipped', reason: 'sprouts' },
    ]);
    expect(fetchCircularsList).not.toHaveBeenCalled();
    expect(sfwFetchPublications).not.toHaveBeenCalled();
  });

  it('checks only the requested store when instanceId is given', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(SFW_STORE);
    mockSafewayPublications([SFW_POST_HOLIDAY]);
    vi.mocked(getCircular).mockResolvedValue(storedCircular(SFW_STORE.instanceId, '2026-W48', '200'));

    const report = await runLiveCircularCheck({ instanceId: SFW_STORE.instanceId });

    expect(getAllStores).not.toHaveBeenCalled();
    expect(getStoreInstance).toHaveBeenCalledWith(SFW_STORE.instanceId);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]).toMatchObject({ instanceId: SFW_STORE.instanceId, result: 'already_scraped' });
  });

  it('reports store_not_found for an unknown instanceId', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(null);

    const report = await runLiveCircularCheck({ instanceId: 'kingsoopers:missing' });

    expect(report.results).toEqual([
      { instanceId: 'kingsoopers:missing', result: 'skipped', reason: 'store_not_found' },
    ]);
  });

  it('keeps checking other stores when one store errors, and the handler then fails', async () => {
    vi.mocked(getAllStores).mockResolvedValue([KS_STORE, SFW_STORE]);
    vi.mocked(fetchCircularsList).mockRejectedValue(new Error('Scraper worker error: 502 - bad gateway'));
    mockSafewayPublications([SFW_POST_HOLIDAY]);
    vi.mocked(sfwFetchAndPersist).mockResolvedValue(persistResult('200', '2026-W48', 5));

    const report = await runLiveCircularCheck();

    expect(report.results).toEqual([
      { instanceId: KS_STORE.instanceId, result: 'error', message: 'Scraper worker error: 502 - bad gateway' },
      { instanceId: SFW_STORE.instanceId, result: 'scraped', circularId: '200', weekId: '2026-W48', dealCount: 5, persisted: true },
    ]);

    await expect(handler(undefined, {} as any, () => {})).rejects.toThrow(
      `live circular check failed for: ${KS_STORE.instanceId}`,
    );
  });
});
