import {
  STORE_TYPE_METADATA,
  StoreType,
  getStoreTypeFromInstanceId,
  getStoreDisplayName,
  getStoreSeverity,
  STORE_SEVERITY,
} from './store.model';

describe('store.model', () => {
  describe('STORE_TYPE_METADATA', () => {
    it('should have 3 entries', () => {
      expect(Object.keys(STORE_TYPE_METADATA)).toHaveLength(3);
    });

    it('should have correct metadata for kingsoopers', () => {
      expect(STORE_TYPE_METADATA.kingsoopers).toEqual({ name: 'King Soopers', chain: 'kroger', abbr: 'KS' });
    });

    it('should have correct metadata for safeway', () => {
      expect(STORE_TYPE_METADATA.safeway).toEqual({ name: 'Safeway', chain: 'albertsons', abbr: 'SW' });
    });

    it('should have correct metadata for sprouts', () => {
      expect(STORE_TYPE_METADATA.sprouts).toEqual({ name: 'Sprouts', chain: 'sprouts', abbr: 'SP' });
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

  describe('STORE_SEVERITY', () => {
    it('should have 3 entries', () => {
      expect(Object.keys(STORE_SEVERITY)).toHaveLength(3);
    });

    it('should have correct severity for kingsoopers', () => {
      expect(STORE_SEVERITY.kingsoopers).toEqual('info');
    });

    it('should have correct severity for safeway', () => {
      expect(STORE_SEVERITY.safeway).toEqual('danger');
    });

    it('should have correct severity for sprouts', () => {
      expect(STORE_SEVERITY.sprouts).toEqual('success');
    });
  });

  describe('getStoreSeverity', () => {
    it('should return info for kingsoopers', () => {
      expect(getStoreSeverity('kingsoopers:abc')).toBe('info')
    });

    it('should return danger for safeway', () => {
      expect(getStoreSeverity('safeway:def')).toBe('danger');
    });

    it('should return success for sprouts', () => {
      expect(getStoreSeverity('sprouts:ghi')).toBe('success');
    });

    it('should fall back to secondary for unknown store type', () => {
      expect(getStoreSeverity('walmart:xyz')).toBe('secondary');
    });
  });
});
