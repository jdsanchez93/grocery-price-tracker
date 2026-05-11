import { getLoyaltyIcon, getLoyaltyTooltip } from './loyalty';

describe('loyalty', () => {
  describe('getLoyaltyIcon', () => {
    it('returns tag icon for "digital"', () => {
      expect(getLoyaltyIcon('digital')).toBe('pi pi-tag');
    });

    it('returns tag icon for "coupon"', () => {
      expect(getLoyaltyIcon('coupon')).toBe('pi pi-tag');
    });

    it('returns tag icon for mixed-case "Digital Coupon"', () => {
      expect(getLoyaltyIcon('Digital Coupon')).toBe('pi pi-tag');
    });

    it('returns credit-card icon for "card"', () => {
      expect(getLoyaltyIcon('card')).toBe('pi pi-credit-card');
    });

    it('returns credit-card icon for "card_required"', () => {
      expect(getLoyaltyIcon('card_required')).toBe('pi pi-credit-card');
    });

    it('returns star icon as fallback for unknown loyalty', () => {
      expect(getLoyaltyIcon('member-only')).toBe('pi pi-star');
    });
  });

  describe('getLoyaltyTooltip', () => {
    it('returns coupon message for "digital"', () => {
      expect(getLoyaltyTooltip('digital')).toBe('Requires digital coupon');
    });

    it('returns coupon message for "coupon"', () => {
      expect(getLoyaltyTooltip('coupon')).toBe('Requires digital coupon');
    });

    it('returns card message for "card"', () => {
      expect(getLoyaltyTooltip('card')).toBe('Requires loyalty card');
    });

    it('returns card message for "card_required"', () => {
      expect(getLoyaltyTooltip('card_required')).toBe('Requires loyalty card');
    });

    it('falls back to the raw value for unknown loyalty', () => {
      expect(getLoyaltyTooltip('member-only')).toBe('member-only');
    });
  });
});
