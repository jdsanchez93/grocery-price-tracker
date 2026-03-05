import {
  Deal,
  STORE_TYPE_METADATA,
  StoreType,
  getStoreTypeFromInstanceId,
  getStoreDisplayName,
} from './deal.model';

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    dealId: 'deal-1',
    storeInstanceId: 'kingsoopers:abc123',
    weekId: '2026-W04',
    name: 'Test Deal',
    details: undefined,
    dept: 'Produce',
    priceDisplay: '$1.99',
    priceNumber: 1.99,
    quantity: 1,
    loyalty: undefined,
    image: undefined,
    ...overrides,
  };
}

describe('deal.model', () => {
  describe('STORE_TYPE_METADATA', () => {
    it('should have 3 entries', () => {
      expect(Object.keys(STORE_TYPE_METADATA)).toHaveLength(3);
    });

    it('should have correct metadata for kingsoopers', () => {
      expect(STORE_TYPE_METADATA.kingsoopers).toEqual({ name: 'King Soopers', chain: 'kroger' });
    });

    it('should have correct metadata for safeway', () => {
      expect(STORE_TYPE_METADATA.safeway).toEqual({ name: 'Safeway', chain: 'albertsons' });
    });

    it('should have correct metadata for sprouts', () => {
      expect(STORE_TYPE_METADATA.sprouts).toEqual({ name: 'Sprouts', chain: 'sprouts' });
    });
  });

  describe('getStoreTypeFromInstanceId', () => {
    it('should extract store type from instance ID with colon', () => {
      expect(getStoreTypeFromInstanceId('kingsoopers:abc123')).toBe('kingsoopers');
    });

    it('should return the full string when no colon is present', () => {
      expect(getStoreTypeFromInstanceId('kingsoopers')).toBe('kingsoopers');
    });

    it('should handle multiple colons by taking the first segment', () => {
      expect(getStoreTypeFromInstanceId('safeway:store:123')).toBe('safeway');
    });

    it('should return the raw prefix for unknown store types', () => {
      expect(getStoreTypeFromInstanceId('walmart:xyz')).toBe('walmart' as StoreType);
    });
  });

  describe('getStoreDisplayName', () => {
    it('should return display name for kingsoopers', () => {
      expect(getStoreDisplayName('kingsoopers:abc')).toBe('King Soopers');
    });

    it('should return display name for safeway', () => {
      expect(getStoreDisplayName('safeway:def')).toBe('Safeway');
    });

    it('should return display name for sprouts', () => {
      expect(getStoreDisplayName('sprouts:ghi')).toBe('Sprouts');
    });

    it('should fall back to raw instanceId for unknown store type', () => {
      expect(getStoreDisplayName('walmart:xyz')).toBe('walmart:xyz');
    });
  });
});
