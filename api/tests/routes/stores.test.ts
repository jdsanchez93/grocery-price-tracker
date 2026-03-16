import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => async (c: any, next: any) => { await next(); },
  requirePermission: () => async (c: any, next: any) => { await next(); },
  getAuthUser: () => ({ userId: 'admin:test', email: 'admin@test.com', permissions: ['stores:write'] }),
  hasPermission: () => false,
}));

vi.mock('../../src/db/client', () => ({
  getAllStores: vi.fn().mockResolvedValue([]),
  writeStoreInstance: vi.fn(),
  updateStoreInstance: vi.fn(),
  getStoreInstance: vi.fn(),
  getStoreInstancesByType: vi.fn().mockResolvedValue([]),
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

const INSTANCE_ID = 'kingsoopers:abc123';

const mockStore = {
  PK: `STOREINSTANCE#${INSTANCE_ID}`,
  SK: 'METADATA',
  entityType: 'STORE_INSTANCE' as const,
  instanceId: INSTANCE_ID,
  storeType: 'kingsoopers' as const,
  name: 'Updated Name',
  identifiers: { type: 'kingsoopers', storeId: '123', facilityId: '456' },
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

function patch(instanceId: string, body: unknown) {
  return createApp().request(`/api/admin/stores/${instanceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/admin/stores/:instanceId', () => {
  beforeEach(() => {
    vi.mocked(dbClient.updateStoreInstance).mockReset();
  });

  // --- validation ---

  it('returns 400 when name is missing from body', async () => {
    const res = await patch(INSTANCE_ID, {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when name is empty string', async () => {
    const res = await patch(INSTANCE_ID, { name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is whitespace only', async () => {
    const res = await patch(INSTANCE_ID, { name: '   ' });
    expect(res.status).toBe(400);
  });

  // --- not found ---

  it('returns 404 when store does not exist', async () => {
    vi.mocked(dbClient.updateStoreInstance).mockResolvedValue(null);
    const res = await patch(INSTANCE_ID, { name: 'New Name' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  // --- success ---

  it('returns 200 with updated store', async () => {
    vi.mocked(dbClient.updateStoreInstance).mockResolvedValue(mockStore);
    const res = await patch(INSTANCE_ID, { name: 'Updated Name' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.store).toEqual(mockStore);
  });

  it('trims whitespace from name before calling updateStoreInstance', async () => {
    vi.mocked(dbClient.updateStoreInstance).mockResolvedValue(mockStore);
    await patch(INSTANCE_ID, { name: '  Updated Name  ' });
    expect(vi.mocked(dbClient.updateStoreInstance)).toHaveBeenCalledWith(
      INSTANCE_ID,
      expect.objectContaining({ name: 'Updated Name' }),
    );
  });

  it('passes address through when provided', async () => {
    vi.mocked(dbClient.updateStoreInstance).mockResolvedValue(mockStore);
    const address = { addressLine1: '123 Main St', city: 'Denver', state: 'CO', zipCode: '80201' };
    await patch(INSTANCE_ID, { name: 'Updated Name', address });
    expect(vi.mocked(dbClient.updateStoreInstance)).toHaveBeenCalledWith(INSTANCE_ID, {
      name: 'Updated Name',
      address,
    });
  });

  it('passes undefined address when address is omitted from body', async () => {
    vi.mocked(dbClient.updateStoreInstance).mockResolvedValue(mockStore);
    await patch(INSTANCE_ID, { name: 'Updated Name' });
    expect(vi.mocked(dbClient.updateStoreInstance)).toHaveBeenCalledWith(INSTANCE_ID, {
      name: 'Updated Name',
      address: undefined,
    });
  });
});
