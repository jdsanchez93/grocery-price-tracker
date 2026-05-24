import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
  ConditionalCheckFailedException: class extends Error {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  PutCommand: vi.fn((input: unknown) => ({ _type: 'PutCommand', input })),
  UpdateCommand: vi.fn((input: unknown) => ({ _type: 'UpdateCommand', input })),
  GetCommand: vi.fn((input: unknown) => ({ _type: 'GetCommand', input })),
  QueryCommand: vi.fn((input: unknown) => ({ _type: 'QueryCommand', input })),
  DeleteCommand: vi.fn((input: unknown) => ({ _type: 'DeleteCommand', input })),
  BatchWriteCommand: vi.fn((input: unknown) => ({ _type: 'BatchWriteCommand', input })),
  ScanCommand: vi.fn((input: unknown) => ({ _type: 'ScanCommand', input })),
}));

vi.mock('crypto', async (importOriginal) => importOriginal());
vi.mock('../../src/scraper/products', () => ({
  normalizeDept: vi.fn((dept: string) => dept),
  matchCanonicalProduct: vi.fn(),
}));

import { getActiveDealsForUserStores } from '../../src/db/client';
import type { DealItem } from '../../src/types/database';

// At 2026-05-20T01:00:00Z it is Tue 2026-05-19 19:00 in Denver, so the active
// weekId for an America/Denver store is the week of the 2026-05-13 circular.
const NOW = new Date('2026-05-20T01:00:00Z');
const WEEK = '2026-W20';

const KS_PK = `STORE#kingsoopers:abc#WEEK#${WEEK}`;
const SW_PK = `STORE#safeway:xyz#WEEK#${WEEK}`;

function makeDeal(id: string, store: string): DealItem {
  return {
    PK: `STORE#${store}#WEEK#${WEEK}`,
    SK: `DEAL#${id}`,
    entityType: 'DEAL',
    dealId: id,
    storeInstanceId: store,
    weekId: WEEK,
    name: id,
    details: undefined,
    dept: 'produce',
    priceDisplay: '$1.99',
    priceNumber: 1.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

const storeInstances: Record<string, unknown> = {
  'STOREINSTANCE#kingsoopers:abc': { instanceId: 'kingsoopers:abc', timezone: 'America/Denver', storeType: 'kingsoopers' },
  'STOREINSTANCE#safeway:xyz': { instanceId: 'safeway:xyz', timezone: 'America/Denver', storeType: 'safeway' },
};

let userStores: unknown[];
let circulars: Record<string, unknown | undefined>;
let dealsByPk: Record<string, DealItem[]>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  userStores = [
    { storeInstanceId: 'kingsoopers:abc' },
    { storeInstanceId: 'safeway:xyz' },
  ];
  circulars = {
    [KS_PK]: { storeInstanceId: 'kingsoopers:abc', weekId: WEEK, circularId: 'c1', startDate: '2026-05-13', endDate: '2026-05-19', dealCount: 2 },
    [SW_PK]: undefined, // not yet scraped
  };
  dealsByPk = {
    [KS_PK]: [makeDeal('d1', 'kingsoopers:abc'), makeDeal('d2', 'kingsoopers:abc')],
    [SW_PK]: [],
  };

  mockSend.mockImplementation((cmd: { _type: string; input: any }) => {
    const { _type, input } = cmd;
    if (_type === 'QueryCommand') {
      const pk = input.ExpressionAttributeValues[':pk'];
      const skPrefix = input.ExpressionAttributeValues[':skPrefix'];
      if (skPrefix === 'STOREINSTANCE#') return Promise.resolve({ Items: userStores });
      if (skPrefix === 'DEAL#') return Promise.resolve({ Items: dealsByPk[pk] ?? [] });
    }
    if (_type === 'GetCommand') {
      const pk = input.Key.PK as string;
      if (pk.startsWith('STOREINSTANCE#')) return Promise.resolve({ Item: storeInstances[pk] });
      return Promise.resolve({ Item: circulars[pk] }); // circular METADATA
    }
    return Promise.resolve({});
  });
});

afterEach(() => {
  vi.useRealTimers();
  mockSend.mockReset();
});

describe('getActiveDealsForUserStores', () => {
  it('returns each store\'s active circular and merges deals', async () => {
    const { circulars: result, deals } = await getActiveDealsForUserStores('user-1');

    const ks = result.find((c) => c.storeInstanceId === 'kingsoopers:abc');
    expect(ks).toMatchObject({ weekId: WEEK, startDate: '2026-05-13', endDate: '2026-05-19', dealCount: 2 });

    expect(deals).toHaveLength(2);
    expect(deals.map((d) => d.dealId).sort()).toEqual(['d1', 'd2']);
  });

  it('marks a store with no circular as not_yet_scraped (not silently dropped)', async () => {
    const { circulars: result } = await getActiveDealsForUserStores('user-1');

    const sw = result.find((c) => c.storeInstanceId === 'safeway:xyz');
    expect(sw).toEqual({ storeInstanceId: 'safeway:xyz', circular: null, reason: 'not_yet_scraped' });
    expect(result).toHaveLength(2);
  });

  it('marks a missing store instance as store_not_found', async () => {
    userStores = [{ storeInstanceId: 'kingsoopers:gone' }];

    const { circulars: result, deals } = await getActiveDealsForUserStores('user-1');
    expect(result).toEqual([{ storeInstanceId: 'kingsoopers:gone', circular: null, reason: 'store_not_found' }]);
    expect(deals).toHaveLength(0);
  });

  it('returns empty for a user with no stores', async () => {
    userStores = [];
    const result = await getActiveDealsForUserStores('user-1');
    expect(result).toEqual({ circulars: [], deals: [] });
  });
});
