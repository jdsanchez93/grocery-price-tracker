import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
  ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  ScanCommand: vi.fn((input: unknown) => ({ _type: 'ScanCommand', input })),
  PutCommand: vi.fn((input: unknown) => ({ _type: 'PutCommand', input })),
  UpdateCommand: vi.fn((input: unknown) => ({ _type: 'UpdateCommand', input })),
  GetCommand: vi.fn((input: unknown) => ({ _type: 'GetCommand', input })),
  QueryCommand: vi.fn((input: unknown) => ({ _type: 'QueryCommand', input })),
  DeleteCommand: vi.fn((input: unknown) => ({ _type: 'DeleteCommand', input })),
  BatchWriteCommand: vi.fn((input: unknown) => ({ _type: 'BatchWriteCommand', input })),
}));

// crypto is used by db/client for generateStoreInstanceId
vi.mock('crypto', async (importOriginal) => importOriginal());

const mockStoreItem = {
  PK: 'STOREINSTANCE#kingsoopers:abc123',
  SK: 'METADATA',
  entityType: 'STORE_INSTANCE' as const,
  instanceId: 'kingsoopers:abc123',
  storeType: 'kingsoopers' as const,
  name: 'King Soopers #1',
  identifiers: { type: 'kingsoopers' as const, storeId: '1', facilityId: '2' },
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function scanReturns(items: unknown[] = [mockStoreItem]) {
  mockSend.mockImplementation((cmd: { _type: string }) => {
    if (cmd._type === 'ScanCommand') return Promise.resolve({ Items: items });
    return Promise.resolve({ Attributes: items[0] });
  });
}

function scanCalls() {
  return mockSend.mock.calls.filter(([cmd]) => cmd._type === 'ScanCommand').length;
}

describe('getAllStores — module-level cache', () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockReset();
  });

  it('scans DynamoDB on first call', async () => {
    scanReturns();
    const { getAllStores } = await import('../../src/db/client');
    await getAllStores();
    expect(scanCalls()).toBe(1);
  });

  it('returns cached result on second call without re-scanning', async () => {
    scanReturns();
    const { getAllStores } = await import('../../src/db/client');
    const first = await getAllStores();
    const second = await getAllStores();
    expect(scanCalls()).toBe(1);
    expect(second).toStrictEqual(first);
  });

  it('re-scans after TTL expires', async () => {
    vi.useFakeTimers();
    try {
      scanReturns();
      const { getAllStores } = await import('../../src/db/client');
      await getAllStores();
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await getAllStores();
      expect(scanCalls()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not re-scan just before TTL expires', async () => {
    vi.useFakeTimers();
    try {
      scanReturns();
      const { getAllStores } = await import('../../src/db/client');
      await getAllStores();
      vi.advanceTimersByTime(5 * 60 * 1000 - 1);
      await getAllStores();
      expect(scanCalls()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidates cache when writeStoreInstance is called', async () => {
    scanReturns();
    const { getAllStores, writeStoreInstance } = await import('../../src/db/client');
    await getAllStores();                                                      // scan #1
    await writeStoreInstance({ type: 'kingsoopers', storeId: '1', facilityId: '2' }, 'Test');
    await getAllStores();                                                      // scan #2
    expect(scanCalls()).toBe(2);
  });

  it('invalidates cache when updateStoreInstance is called', async () => {
    scanReturns();
    const { getAllStores, updateStoreInstance } = await import('../../src/db/client');
    await getAllStores();                                                      // scan #1
    await updateStoreInstance('kingsoopers:abc123', { name: 'New Name' });
    await getAllStores();                                                      // scan #2
    expect(scanCalls()).toBe(2);
  });

  it('handles paginated scan and returns all pages', async () => {
    const page1Item = { ...mockStoreItem, instanceId: 'kingsoopers:page1' };
    const page2Item = { ...mockStoreItem, instanceId: 'kingsoopers:page2' };
    let callCount = 0;
    mockSend.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ Items: [page1Item], LastEvaluatedKey: { PK: 'cursor' } });
      return Promise.resolve({ Items: [page2Item] });
    });

    const { getAllStores } = await import('../../src/db/client');
    const result = await getAllStores();
    expect(result).toHaveLength(2);
    expect(result.map(s => s.instanceId)).toEqual(['kingsoopers:page1', 'kingsoopers:page2']);
    expect(scanCalls()).toBe(2); // two pages fetched
  });
});
