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

// normalizeDept is called when updating dept — mock it to return the input unchanged
vi.mock('../../src/scraper/products', () => ({
  normalizeDept: vi.fn((dept: string) => dept),
  matchCanonicalProduct: vi.fn(),
}));

import { updateDeal } from '../../src/db/client';
import type { DealItem } from '../../src/types/database';

// ── helpers ──────────────────────────────────────────────────────────────────

function sentUpdateInput(): Record<string, unknown> {
  const call = mockSend.mock.calls.find(([cmd]) => cmd._type === 'UpdateCommand');
  if (!call) throw new Error('No UpdateCommand was sent');
  return call[0].input as Record<string, unknown>;
}

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

// ── tests ─────────────────────────────────────────────────────────────────────

describe('updateDeal', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('early return', () => {
    it('returns the deal unchanged when no updates are provided', async () => {
      const result = await updateDeal(mockDeal, {}, 'admin:123');
      expect(result).toBe(mockDeal);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('setting canonicalProductId', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Attributes: { ...mockDeal, canonicalProductId: 'soda' } });
    });

    it('includes canonicalProductId and GSI1PK in the SET expression', async () => {
      await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123');
      const { UpdateExpression } = sentUpdateInput();
      expect(UpdateExpression).toContain('canonicalProductId = :cpi');
      expect(UpdateExpression).toContain('GSI1PK = :gsi1pk');
    });

    it('does not include a REMOVE clause', async () => {
      await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123');
      expect(sentUpdateInput().UpdateExpression).not.toContain('REMOVE');
    });

    it('sets the correct ExpressionAttributeValues for canonical product', async () => {
      await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123');
      const { ExpressionAttributeValues } = sentUpdateInput() as { ExpressionAttributeValues: Record<string, unknown> };
      expect(ExpressionAttributeValues[':cpi']).toBe('soda');
      expect(ExpressionAttributeValues[':gsi1pk']).toBe('PRODUCT#soda');
    });

    it('returns the updated deal from DynamoDB', async () => {
      const updated = { ...mockDeal, canonicalProductId: 'soda' };
      mockSend.mockResolvedValue({ Attributes: updated });
      const result = await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123');
      expect(result).toEqual(updated);
    });
  });

  describe('clearing canonicalProductId (null)', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Attributes: { ...mockDeal } });
    });

    it('includes REMOVE clause for canonicalProductId, GSI1PK, and GSI1SK', async () => {
      await updateDeal(mockDeal, { canonicalProductId: null }, 'admin:123');
      const { UpdateExpression } = sentUpdateInput();
      expect(UpdateExpression).toContain('REMOVE canonicalProductId, GSI1PK, GSI1SK');
    });

    it('does not include :cpi in ExpressionAttributeValues', async () => {
      await updateDeal(mockDeal, { canonicalProductId: null }, 'admin:123');
      const { ExpressionAttributeValues } = sentUpdateInput() as { ExpressionAttributeValues: Record<string, unknown> };
      expect(ExpressionAttributeValues[':cpi']).toBeUndefined();
      expect(ExpressionAttributeValues[':gsi1pk']).toBeUndefined();
    });
  });

  describe('updating dept', () => {
    beforeEach(() => {
      mockSend.mockResolvedValue({ Attributes: { ...mockDeal, dept: 'produce' } });
    });

    it('includes dept in the SET expression', async () => {
      await updateDeal(mockDeal, { dept: 'produce' }, 'admin:123');
      const { UpdateExpression } = sentUpdateInput();
      expect(UpdateExpression).toContain('dept = :dept');
      expect(UpdateExpression).not.toContain('GSI2SK');
    });

    it('sets the correct ExpressionAttributeValue for dept', async () => {
      await updateDeal(mockDeal, { dept: 'produce' }, 'admin:123');
      const { ExpressionAttributeValues } = sentUpdateInput() as { ExpressionAttributeValues: Record<string, unknown> };
      expect(ExpressionAttributeValues[':dept']).toBe('produce');
      expect(ExpressionAttributeValues[':gsi2sk']).toBeUndefined();
    });
  });

  describe('updatedBy', () => {
    it('stamps the caller user ID into ExpressionAttributeValues', async () => {
      mockSend.mockResolvedValue({ Attributes: mockDeal });
      await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:456');
      const { ExpressionAttributeValues } = sentUpdateInput() as { ExpressionAttributeValues: Record<string, unknown> };
      expect(ExpressionAttributeValues[':updatedBy']).toBe('admin:456');
    });
  });

  describe('DynamoDB key and condition', () => {
    it('uses the deal PK and SK as the update key', async () => {
      mockSend.mockResolvedValue({ Attributes: mockDeal });
      await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123');
      const input = sentUpdateInput() as { Key: { PK: string; SK: string } };
      expect(input.Key.PK).toBe(mockDeal.PK);
      expect(input.Key.SK).toBe(mockDeal.SK);
    });

    it('includes a condition expression to guard against non-existent items', async () => {
      mockSend.mockResolvedValue({ Attributes: mockDeal });
      await updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123');
      expect(sentUpdateInput().ConditionExpression).toBe('attribute_exists(PK)');
    });
  });

  describe('error handling', () => {
    it('propagates DynamoDB errors without swallowing them', async () => {
      mockSend.mockRejectedValue(new Error('condition failed'));
      await expect(updateDeal(mockDeal, { canonicalProductId: 'soda' }, 'admin:123'))
        .rejects.toThrow('condition failed');
    });
  });
});
