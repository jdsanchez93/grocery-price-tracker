import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => { await next(); },
  getAuthUser: () => ({ userId: 'admin:123', email: 'admin@test.com', permissions: ['deals:write'] }),
  hasPermission: () => true,
}));

vi.mock('../../src/db/client', () => ({
  getAllStores: vi.fn(),
  writeStoreInstance: vi.fn(),
  updateStoreInstance: vi.fn(),
  getStoreInstance: vi.fn(),
  getCircular: vi.fn(),
  deleteCircularAndDeals: vi.fn(),
  getDealsForUserStores: vi.fn(),
  getDealsForStoreWeek: vi.fn(),
  getUserStores: vi.fn(),
  addUserStore: vi.fn(),
  removeUserStore: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUserOnboarded: vi.fn(),
  getPriceHistory: vi.fn(),
  getDeal: vi.fn(),
  updateDeal: vi.fn(),
}));

vi.mock('../../src/scraper/kingsoopers', () => ({
  fetchWeeklyDeals: vi.fn(),
  fetchAndPersistWeeklyDeals: vi.fn(),
  fetchCirculars: vi.fn(),
  extractWeeklyAdMetadata: vi.fn(),
}));

vi.mock('../../src/scraper/safeway', () => ({
  fetchPublications: vi.fn(),
  extractWeeklyAdMetadata: vi.fn(),
  fetchWeeklyDeals: vi.fn(),
  fetchAndPersistWeeklyDeals: vi.fn(),
}));

import { createApp } from '../../src/app';
import * as dbClient from '../../src/db/client';
import type { DealItem } from '../../src/types/database';

// ── fixtures ─────────────────────────────────────────────────────────────────

const mockDeal: DealItem = {
  PK: 'STORE#kingsoopers:abc123#WEEK#2026-W17',
  SK: 'DEAL#deal001',
  entityType: 'DEAL',
  dealId: 'deal001',
  storeInstanceId: 'kingsoopers:abc123',
  weekId: '2026-W17',
  name: 'Coca Cola',
  details: '12-Pack, 12 fl oz Cans',
  dept: 'beverages',
  priceDisplay: '$5.99',
  priceNumber: 5.99,
  quantity: 1,
  loyalty: undefined,
  image: undefined,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ── GET /admin/deals/:instanceId/:weekId ──────────────────────────────────────

describe('GET /admin/deals/:instanceId/:weekId', () => {
  beforeEach(() => {
    vi.mocked(dbClient.getDealsForStoreWeek).mockReset();
  });

  it('returns deals with weekId and count', async () => {
    vi.mocked(dbClient.getDealsForStoreWeek).mockResolvedValue([mockDeal]);
    const res = await createApp().request('/api/admin/deals/kingsoopers:abc123/2026-W17');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weekId).toBe('2026-W17');
    expect(body.deals).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('returns empty deals array when no deals exist for the week', async () => {
    vi.mocked(dbClient.getDealsForStoreWeek).mockResolvedValue([]);
    const res = await createApp().request('/api/admin/deals/kingsoopers:abc123/2026-W17');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('queries with the instanceId and weekId from the route params', async () => {
    vi.mocked(dbClient.getDealsForStoreWeek).mockResolvedValue([]);
    await createApp().request('/api/admin/deals/kingsoopers:abc123/2026-W17');
    expect(dbClient.getDealsForStoreWeek).toHaveBeenCalledWith('kingsoopers:abc123', '2026-W17');
  });
});

// ── PATCH /admin/deals/:instanceId/:weekId/:dealId ────────────────────────────

describe('PATCH /admin/deals/:instanceId/:weekId/:dealId', () => {
  function patch(body: object) {
    return createApp().request('/api/admin/deals/kingsoopers:abc123/2026-W17/deal001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.mocked(dbClient.getDeal).mockReset();
    vi.mocked(dbClient.updateDeal).mockReset();
  });

  it('returns 400 when body contains no updatable fields', async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when deal does not exist', async () => {
    vi.mocked(dbClient.getDeal).mockResolvedValue(null as any);
    const res = await patch({ canonicalProductId: 'soda' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it('returns the updated deal on success', async () => {
    const updatedDeal = { ...mockDeal, canonicalProductId: 'soda' };
    vi.mocked(dbClient.getDeal).mockResolvedValue(mockDeal);
    vi.mocked(dbClient.updateDeal).mockResolvedValue(updatedDeal);
    const res = await patch({ canonicalProductId: 'soda' });
    expect(res.status).toBe(200);
    expect((await res.json()).deal).toMatchObject({ canonicalProductId: 'soda' });
  });

  it('calls updateDeal with updatedBy from the authenticated user', async () => {
    vi.mocked(dbClient.getDeal).mockResolvedValue(mockDeal);
    vi.mocked(dbClient.updateDeal).mockResolvedValue(mockDeal);
    await patch({ canonicalProductId: 'soda' });
    expect(dbClient.updateDeal).toHaveBeenCalledWith(
      mockDeal,
      expect.objectContaining({ canonicalProductId: 'soda' }),
      'admin:123'
    );
  });

  it('passes the canonicalProductId from the request body to updateDeal', async () => {
    vi.mocked(dbClient.getDeal).mockResolvedValue(mockDeal);
    vi.mocked(dbClient.updateDeal).mockResolvedValue(mockDeal);
    await patch({ canonicalProductId: 'juice' });
    expect(dbClient.updateDeal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ canonicalProductId: 'juice' }),
      expect.any(String)
    );
  });
});
