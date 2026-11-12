import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
  ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {
    name = 'ConditionalCheckFailedException';
  },
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
}));

import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { backfillDealGsi1Sk } from '../../src/db/client';
import type { DealItem } from '../../src/types/database';

// ── helpers ──────────────────────────────────────────────────────────────────

function sentCommands(type: string): Record<string, any>[] {
  return mockSend.mock.calls.filter(([cmd]) => cmd._type === type).map(([cmd]) => cmd.input);
}

// A deal whose product ID was set by the old updateDeal: GSI1PK without GSI1SK
function editedDeal(dealId: string, storeInstanceId: string, weekId: string): DealItem {
  return {
    PK: `STORE#${storeInstanceId}#WEEK#${weekId}`,
    SK: `DEAL#${dealId}`,
    GSI1PK: 'PRODUCT#yogurt',
    entityType: 'DEAL',
    dealId,
    storeInstanceId,
    weekId,
    name: 'Noosa Yoghurt',
    details: '4-8 oz',
    dept: 'dairy',
    priceDisplay: '2/$5',
    priceNumber: 2.5,
    quantity: 2,
    loyalty: undefined,
    image: undefined,
    canonicalProductId: 'yogurt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const dealA = editedDeal('deal001', 'kingsoopers:abc123', '2026-W40');
const dealB = editedDeal('deal002', 'safeway:def456', '2026-W41');

// ── tests ─────────────────────────────────────────────────────────────────────

describe('backfillDealGsi1Sk', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('scans only for deals that have GSI1PK but are missing GSI1SK', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await backfillDealGsi1Sk(true);
    const [scan] = sentCommands('ScanCommand');
    expect(scan.FilterExpression).toBe(
      'entityType = :et AND attribute_exists(GSI1PK) AND attribute_not_exists(GSI1SK)'
    );
    expect(scan.ExpressionAttributeValues).toEqual({ ':et': 'DEAL' });
  });

  it('follows LastEvaluatedKey across scan pages', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [dealA], LastEvaluatedKey: { PK: dealA.PK, SK: dealA.SK } })
      .mockResolvedValueOnce({ Items: [dealB] });
    const result = await backfillDealGsi1Sk(true);
    const scans = sentCommands('ScanCommand');
    expect(scans).toHaveLength(2);
    expect(scans[1].ExclusiveStartKey).toEqual({ PK: dealA.PK, SK: dealA.SK });
    expect(result.deals.map(d => d.dealId)).toEqual(['deal001', 'deal002']);
  });

  describe('dry run', () => {
    it('lists affected deals without writing anything', async () => {
      mockSend.mockResolvedValueOnce({ Items: [dealA, dealB] });
      const result = await backfillDealGsi1Sk(true);
      expect(sentCommands('UpdateCommand')).toHaveLength(0);
      expect(result).toEqual({
        dryRun: true,
        updated: 0,
        skipped: 0,
        deals: [
          { storeInstanceId: 'kingsoopers:abc123', weekId: '2026-W40', dealId: 'deal001', name: 'Noosa Yoghurt', canonicalProductId: 'yogurt' },
          { storeInstanceId: 'safeway:def456', weekId: '2026-W41', dealId: 'deal002', name: 'Noosa Yoghurt', canonicalProductId: 'yogurt' },
        ],
      });
    });
  });

  describe('write mode', () => {
    it('sets GSI1SK from each deal’s own weekId and storeInstanceId', async () => {
      mockSend.mockResolvedValueOnce({ Items: [dealA, dealB] }).mockResolvedValue({});
      const result = await backfillDealGsi1Sk(false);
      const updates = sentCommands('UpdateCommand');
      expect(updates).toHaveLength(2);
      expect(updates[0].Key).toEqual({ PK: dealA.PK, SK: dealA.SK });
      expect(updates[0].UpdateExpression).toBe('SET GSI1SK = :gsi1sk');
      expect(updates[0].ExpressionAttributeValues).toEqual({ ':gsi1sk': '2026-W40#kingsoopers:abc123' });
      expect(updates[1].ExpressionAttributeValues).toEqual({ ':gsi1sk': '2026-W41#safeway:def456' });
      expect(result).toMatchObject({ dryRun: false, updated: 2, skipped: 0 });
    });

    it('guards each write so a deal deleted since the scan is not recreated as a stub', async () => {
      mockSend.mockResolvedValueOnce({ Items: [dealA] }).mockResolvedValue({});
      await backfillDealGsi1Sk(false);
      expect(sentCommands('UpdateCommand')[0].ConditionExpression).toBe(
        'attribute_exists(GSI1PK) AND attribute_not_exists(GSI1SK)'
      );
    });

    it('counts a failed condition as skipped and keeps going', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [dealA, dealB] })
        .mockRejectedValueOnce(new ConditionalCheckFailedException({ message: 'gone', $metadata: {} }))
        .mockResolvedValueOnce({});
      const result = await backfillDealGsi1Sk(false);
      expect(sentCommands('UpdateCommand')).toHaveLength(2);
      expect(result).toMatchObject({ updated: 1, skipped: 1 });
    });

    it('propagates other DynamoDB errors', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [dealA] })
        .mockRejectedValueOnce(new Error('throttled'));
      await expect(backfillDealGsi1Sk(false)).rejects.toThrow('throttled');
    });
  });
});
