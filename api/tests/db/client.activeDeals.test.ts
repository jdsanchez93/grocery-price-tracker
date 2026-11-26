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

import { getActiveDealsForUserStores, getActiveWeekIds, findActiveCircular } from '../../src/db/client';
import type { DealItem } from '../../src/types/database';

// At 2026-05-20T01:00:00Z it is Tue 2026-05-19 19:00 in Denver, so the active
// weekId for an America/Denver store is the week of the 2026-05-13 circular.
const NOW = new Date('2026-05-20T01:00:00Z');
const WEEK = '2026-W20';

const KS_PK = `STORE#kingsoopers:abc#WEEK#${WEEK}`;
const SW_PK = `STORE#safeway:xyz#WEEK#${WEEK}`;

function makeDeal(id: string, store: string, week: string = WEEK): DealItem {
  return {
    PK: `STORE#${store}#WEEK#${week}`,
    SK: `DEAL#${id}`,
    entityType: 'DEAL',
    dealId: id,
    storeInstanceId: store,
    weekId: week,
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

// Thanksgiving 2026: the ad ran Wed Nov 18 → Thu Nov 26 (stored under W47, from its
// startDate), and King Soopers' next ad (Fri Nov 27 → Tue Dec 1) was pre-scraped
// into W48. The old clock-based lookup read W48 on Wed Nov 25 and served the
// not-yet-started ad.
describe('holiday circulars that break the Wed→Tue pattern', () => {
  const W47 = '2026-W47';
  const W48 = '2026-W48';
  const KS = 'kingsoopers:abc';
  const pk = (week: string) => `STORE#${KS}#WEEK#${week}`;

  beforeEach(() => {
    userStores = [{ storeInstanceId: KS }];
    circulars = {
      [pk(W47)]: { storeInstanceId: KS, weekId: W47, circularId: 'thanksgiving', startDate: '2026-11-18', endDate: '2026-11-26', dealCount: 1 },
      [pk(W48)]: { storeInstanceId: KS, weekId: W48, circularId: 'black-friday', startDate: '2026-11-27', endDate: '2026-12-01', dealCount: 1 },
    };
    dealsByPk = {
      [pk(W47)]: [makeDeal('turkey', KS, W47)],
      [pk(W48)]: [makeDeal('tv', KS, W48)],
    };
  });

  it('serves the extended ad on Wed Nov 25, not the pre-scraped ad starting Friday', async () => {
    vi.setSystemTime(new Date('2026-11-25T18:00:00Z')); // Wed 11:00 MST

    const { circulars: result, deals } = await getActiveDealsForUserStores('user-1');
    expect(result).toEqual([
      { storeInstanceId: KS, weekId: W47, startDate: '2026-11-18', endDate: '2026-11-26', dealCount: 1 },
    ]);
    expect(deals.map((d) => d.dealId)).toEqual(['turkey']);
  });

  it('keeps serving it through its last day (Thu Nov 26, late evening)', async () => {
    vi.setSystemTime(new Date('2026-11-27T06:30:00Z')); // Thu 23:30 MST
    expect((await findActiveCircular(KS, 'America/Denver'))?.weekId).toBe(W47);
  });

  it('switches to the next ad at Fri Nov 27 00:00 store-local', async () => {
    vi.setSystemTime(new Date('2026-11-27T07:01:00Z')); // Fri 00:01 MST

    const { deals } = await getActiveDealsForUserStores('user-1');
    expect(deals.map((d) => d.dealId)).toEqual(['tv']);
  });

  it('prefers the circular that started most recently when two overlap', async () => {
    circulars[pk(W48)] = { ...(circulars[pk(W48)] as object), startDate: '2026-11-26' };
    vi.setSystemTime(new Date('2026-11-26T18:00:00Z')); // Thu Nov 26, covered by both
    expect((await findActiveCircular(KS, 'America/Denver'))?.circularId).toBe('black-friday');
  });

  it('reports not_yet_scraped when the gap after an extended ad has no circular', async () => {
    delete circulars[pk(W48)];
    vi.setSystemTime(new Date('2026-11-28T18:00:00Z')); // Sat — W47 ended, W48 not scraped

    const { circulars: result, deals } = await getActiveDealsForUserStores('user-1');
    expect(result).toEqual([{ storeInstanceId: KS, circular: null, reason: 'not_yet_scraped' }]);
    expect(deals).toEqual([]);
  });

  it('gates ?week= on the weekId actually being served, not the calendar week', async () => {
    vi.setSystemTime(new Date('2026-11-25T18:00:00Z'));
    expect(await getActiveWeekIds('user-1')).toEqual(new Set([W47]));
  });
});

describe('findActiveCircular across a year boundary', () => {
  it('finds a Wed Dec 30 circular on Mon Jan 4, when the calendar week has rolled to 2027-W01', async () => {
    const KS = 'kingsoopers:abc';
    circulars = {
      [`STORE#${KS}#WEEK#2026-W53`]: { storeInstanceId: KS, weekId: '2026-W53', circularId: 'nye', startDate: '2026-12-30', endDate: '2027-01-05', dealCount: 1 },
    };
    vi.setSystemTime(new Date('2027-01-04T18:00:00Z'));
    expect((await findActiveCircular(KS, 'America/Denver'))?.circularId).toBe('nye');
  });
});
