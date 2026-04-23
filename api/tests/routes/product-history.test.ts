import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => { await next(); },
  getAuthUser: () => ({ userId: 'user:test', email: 'user@test.com', permissions: ['deals:read', 'history:read'] }),
  hasPermission: () => false,
}));

vi.mock('../../src/db/client', () => ({
  getAllStores: vi.fn(),
  writeStoreInstance: vi.fn(),
  updateStoreInstance: vi.fn(),
  getStoreInstance: vi.fn(),
  getCircular: vi.fn(),
  deleteCircularAndDeals: vi.fn(),
  getDealsForUserStores: vi.fn().mockResolvedValue([]),
  getUserStores: vi.fn().mockResolvedValue([]),
  addUserStore: vi.fn(),
  removeUserStore: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  getPriceHistory: vi.fn(),
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

const STORE_A = 'kingsoopers:abc123';
const STORE_B = 'safeway:xyz789';

const mockDeal = (overrides: Partial<Record<string, unknown>> = {}) => ({
  PK: `STORE#${STORE_A}#WEEK#2026-W10`,
  SK: 'DEAL#abc',
  entityType: 'DEAL' as const,
  dealId: 'abc',
  storeInstanceId: STORE_A,
  weekId: '2026-W10',
  name: 'Chicken Breast',
  details: undefined,
  dept: 'meat',
  priceDisplay: '$3.99/lb',
  priceNumber: 3.99,
  quantity: 1,
  loyalty: undefined,
  image: undefined,
  canonicalProductId: 'chicken-breast',
  createdAt: '2026-03-05T00:00:00.000Z',
  updatedAt: '2026-03-05T00:00:00.000Z',
  GSI1PK: 'PRODUCT#chicken-breast',
  GSI1SK: `2026-W10#${STORE_A}`,
  GSI2PK: 'WEEK#2026-W10',
  GSI2SK: `STORE#${STORE_A}#DEPT#meat`,
  ...overrides,
});

function getHistory(productId: string) {
  return createApp().request(`/api/me/products/${productId}/history`);
}

describe('GET /api/me/products/:id/history', () => {
  beforeEach(() => {
    vi.mocked(dbClient.getUserStores).mockReset();
    vi.mocked(dbClient.getPriceHistory).mockReset();
  });

  // --- no stores ---

  it('returns empty history with message when user has no stores', async () => {
    vi.mocked(dbClient.getUserStores).mockResolvedValue([]);
    const res = await getHistory('chicken-breast');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.productId).toBe('chicken-breast');
    expect(body.history).toEqual([]);
    expect(body.message).toMatch(/add stores/i);
    expect(dbClient.getPriceHistory).not.toHaveBeenCalled();
  });

  // --- success ---

  it('returns history filtered to user stores', async () => {
    const deal = mockDeal();
    vi.mocked(dbClient.getUserStores).mockResolvedValue([
      { userId: 'user:test', storeInstanceId: STORE_A, addedAt: '2026-01-01T00:00:00.000Z' } as any,
    ]);
    vi.mocked(dbClient.getPriceHistory).mockResolvedValue([deal] as any);

    const res = await getHistory('chicken-breast');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.productId).toBe('chicken-breast');
    expect(body.history).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('calls getPriceHistory with all user store instance IDs', async () => {
    vi.mocked(dbClient.getUserStores).mockResolvedValue([
      { userId: 'user:test', storeInstanceId: STORE_A, addedAt: '2026-01-01T00:00:00.000Z' } as any,
      { userId: 'user:test', storeInstanceId: STORE_B, addedAt: '2026-01-01T00:00:00.000Z' } as any,
    ]);
    vi.mocked(dbClient.getPriceHistory).mockResolvedValue([]);

    await getHistory('chicken-breast');
    expect(dbClient.getPriceHistory).toHaveBeenCalledWith(
      'chicken-breast',
      [STORE_A, STORE_B],
    );
  });

  it('URL-encodes product IDs with special characters', async () => {
    vi.mocked(dbClient.getUserStores).mockResolvedValue([
      { userId: 'user:test', storeInstanceId: STORE_A, addedAt: '2026-01-01T00:00:00.000Z' } as any,
    ]);
    vi.mocked(dbClient.getPriceHistory).mockResolvedValue([]);

    const res = await createApp().request('/api/me/products/orange-juice/history');
    expect(res.status).toBe(200);
    expect(dbClient.getPriceHistory).toHaveBeenCalledWith('orange-juice', [STORE_A]);
  });

  it('returns empty array when no history exists for the product', async () => {
    vi.mocked(dbClient.getUserStores).mockResolvedValue([
      { userId: 'user:test', storeInstanceId: STORE_A, addedAt: '2026-01-01T00:00:00.000Z' } as any,
    ]);
    vi.mocked(dbClient.getPriceHistory).mockResolvedValue([]);

    const res = await getHistory('ice-cream');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.history).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('returns deals from multiple weeks in the response', async () => {
    const week1Deal = mockDeal({ weekId: '2026-W10', GSI1SK: `2026-W10#${STORE_A}` });
    const week2Deal = mockDeal({ weekId: '2026-W14', dealId: 'def', SK: 'DEAL#def', GSI1SK: `2026-W14#${STORE_A}` });
    vi.mocked(dbClient.getUserStores).mockResolvedValue([
      { userId: 'user:test', storeInstanceId: STORE_A, addedAt: '2026-01-01T00:00:00.000Z' } as any,
    ]);
    vi.mocked(dbClient.getPriceHistory).mockResolvedValue([week2Deal, week1Deal] as any);

    const res = await getHistory('chicken-breast');
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.history[0].weekId).toBe('2026-W14');
    expect(body.history[1].weekId).toBe('2026-W10');
  });
});
