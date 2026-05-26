import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/client', () => ({
  getStoreInstance: vi.fn(),
}));

vi.mock('../../src/scraper/kingsoopers', async () => {
  const actual = await vi.importActual<typeof import('../../src/scraper/kingsoopers')>('../../src/scraper/kingsoopers');
  return {
    ...actual,
    fetchAndPersistWeeklyDeals: vi.fn(),
    NoCircularError: actual.NoCircularError,
  };
});

vi.mock('../../src/scraper/safeway', () => ({
  fetchPublications: vi.fn(),
  extractWeeklyAds: vi.fn(),
  fetchAndPersistWeeklyDeals: vi.fn(),
}));

import { runWorker } from '../../src/jobs/previewScrapeWorker';
import { getStoreInstance } from '../../src/db/client';
import {
  fetchAndPersistWeeklyDeals as ksFetchAndPersist,
  NoCircularError,
} from '../../src/scraper/kingsoopers';
import {
  fetchPublications,
  extractWeeklyAds,
  fetchAndPersistWeeklyDeals as sfwFetchAndPersist,
} from '../../src/scraper/safeway';

const KS_STORE = {
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
} as any;

const SFW_STORE = {
  PK: 'STOREINSTANCE#safeway:xyz',
  SK: 'METADATA',
  entityType: 'STORE_INSTANCE',
  instanceId: 'safeway:xyz',
  storeType: 'safeway',
  name: 'Safeway Test',
  identifiers: { type: 'safeway', storeId: '3836', postalCode: '80230' },
  enabled: true,
  timezone: 'America/Denver',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as any;

beforeEach(() => {
  vi.mocked(getStoreInstance).mockReset();
  vi.mocked(ksFetchAndPersist).mockReset();
  vi.mocked(fetchPublications).mockReset();
  vi.mocked(extractWeeklyAds).mockReset();
  vi.mocked(sfwFetchAndPersist).mockReset();
});

describe('runWorker', () => {
  it('returns store_not_found and exits cleanly when the store does not exist', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(null);
    const out = await runWorker('kingsoopers:missing');
    expect(out).toEqual({ result: 'store_not_found' });
    expect(ksFetchAndPersist).not.toHaveBeenCalled();
  });

  it('calls Kroger fetchAndPersistWeeklyDeals with preview: true', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(KS_STORE);
    vi.mocked(ksFetchAndPersist).mockResolvedValue({
      deals: [{ name: 'a' }] as any,
      persisted: true,
      alreadyScraped: false,
      circularId: 'circ-1',
      circularDates: { startDate: '2026-05-20', endDate: '2026-05-26' },
      weekId: '2026-W21',
    });

    const out = await runWorker('kingsoopers:abc');

    expect(ksFetchAndPersist).toHaveBeenCalledWith(
      KS_STORE.identifiers,
      KS_STORE.instanceId,
      { preview: true },
    );
    expect(out).toMatchObject({ result: 'scraped', weekId: '2026-W21', alreadyScraped: false, dealCount: 1 });
  });

  it('swallows NoCircularError from Kroger as no_preview_available', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(KS_STORE);
    vi.mocked(ksFetchAndPersist).mockRejectedValue(new NoCircularError('No preview weekly ad circular found'));

    const out = await runWorker('kingsoopers:abc');
    expect(out).toEqual({ result: 'no_preview_available' });
  });

  it('rethrows non-NoCircularError exceptions from Kroger', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(KS_STORE);
    vi.mocked(ksFetchAndPersist).mockRejectedValue(new Error('upstream 500'));

    await expect(runWorker('kingsoopers:abc')).rejects.toThrow('upstream 500');
  });

  it('picks the Safeway future-dated ad and persists it', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(SFW_STORE);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T18:00:00Z')); // Tue noon-ish MDT, today = 2026-05-19 in Denver
    vi.mocked(fetchPublications).mockResolvedValue({ weeklyAdPublicationId: 1, publications: [] as any });
    vi.mocked(extractWeeklyAds).mockReturnValue([
      { circularId: 'current', startDate: '2026-05-13', endDate: '2026-05-19' },
      { circularId: 'preview', startDate: '2026-05-20', endDate: '2026-05-26' },
    ]);
    vi.mocked(sfwFetchAndPersist).mockResolvedValue({ deals: [{}, {}] as any, persisted: true });

    const out = await runWorker('safeway:xyz');

    expect(sfwFetchAndPersist).toHaveBeenCalledWith(
      'preview',
      SFW_STORE.instanceId,
      expect.any(String), // weekId derived from startDate
      { startDate: '2026-05-20', endDate: '2026-05-26' },
    );
    expect(out).toMatchObject({ result: 'scraped', dealCount: 2 });

    vi.useRealTimers();
  });

  it('returns no_preview_available when Safeway has no future ad', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue(SFW_STORE);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T18:00:00Z'));
    vi.mocked(fetchPublications).mockResolvedValue({ weeklyAdPublicationId: 1, publications: [] as any });
    vi.mocked(extractWeeklyAds).mockReturnValue([
      { circularId: 'current', startDate: '2026-05-13', endDate: '2026-05-19' },
    ]);

    const out = await runWorker('safeway:xyz');
    expect(out).toEqual({ result: 'no_preview_available' });
    expect(sfwFetchAndPersist).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns not_implemented for sprouts stores', async () => {
    vi.mocked(getStoreInstance).mockResolvedValue({
      ...SFW_STORE,
      storeType: 'sprouts',
      identifiers: { type: 'sprouts', storeId: '999' },
    });

    const out = await runWorker('sprouts:999');
    expect(out).toEqual({ result: 'not_implemented' });
  });
});
