import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => { await next(); },
  getAuthUser: () => ({ userId: 'user:123', email: 'user@test.com', permissions: ['user-stores:read'] }),
  hasPermission: () => false,
}));

vi.mock('../../src/db/client', () => ({
  getAllStores: vi.fn(),
  writeStoreInstance: vi.fn(),
  updateStoreInstance: vi.fn(),
  getStoreInstance: vi.fn(),
  getStoreInstancesByType: vi.fn(),
  getCircular: vi.fn(),
  deleteCircularAndDeals: vi.fn(),
  getDealsForUserStores: vi.fn(),
  getUserStores: vi.fn(),
  addUserStore: vi.fn(),
  removeUserStore: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUserOnboarded: vi.fn(),
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

const mockUserItem = {
  PK: 'USER#user:123',
  SK: 'PROFILE',
  entityType: 'USER' as const,
  userId: 'user:123',
  email: 'user@test.com',
  onboarded: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('GET /me/profile', () => {
  beforeEach(() => {
    vi.mocked(dbClient.getUser).mockReset();
    vi.mocked(dbClient.createUser).mockReset();
  });

  it('returns onboarded: true when user exists and is onboarded', async () => {
    vi.mocked(dbClient.getUser).mockResolvedValue({ ...mockUserItem, onboarded: true });
    const res = await createApp().request('/api/me/profile');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onboarded: true });
  });

  it('returns onboarded: false when user exists and is not onboarded', async () => {
    vi.mocked(dbClient.getUser).mockResolvedValue({ ...mockUserItem, onboarded: false });
    const res = await createApp().request('/api/me/profile');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onboarded: false });
  });

  it('returns onboarded: false when user exists but field is absent (not yet backfilled)', async () => {
    const { onboarded: _, ...userWithoutFlag } = mockUserItem;
    vi.mocked(dbClient.getUser).mockResolvedValue(userWithoutFlag as any);
    const res = await createApp().request('/api/me/profile');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onboarded: false });
  });

  it('creates user and returns onboarded: false when user does not exist', async () => {
    vi.mocked(dbClient.getUser).mockResolvedValue(null);
    vi.mocked(dbClient.createUser).mockResolvedValue({ ...mockUserItem, onboarded: false });
    const res = await createApp().request('/api/me/profile');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onboarded: false });
    expect(dbClient.createUser).toHaveBeenCalledWith('user:123', 'user@test.com', undefined, false);
  });
});

describe('POST /me/onboarding/complete', () => {
  beforeEach(() => {
    vi.mocked(dbClient.updateUserOnboarded).mockReset();
  });

  it('returns success: true', async () => {
    vi.mocked(dbClient.updateUserOnboarded).mockResolvedValue(undefined);
    const res = await createApp().request('/api/me/onboarding/complete', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('calls updateUserOnboarded with the authenticated user id', async () => {
    vi.mocked(dbClient.updateUserOnboarded).mockResolvedValue(undefined);
    await createApp().request('/api/me/onboarding/complete', { method: 'POST' });
    expect(dbClient.updateUserOnboarded).toHaveBeenCalledWith('user:123');
  });
});
