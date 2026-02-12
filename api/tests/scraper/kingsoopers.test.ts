import { describe, it, expect } from 'vitest';
import { standardizeKingSoopersAd, StandardDeal } from '../../src/scraper/kingsoopers';

describe('standardizeKingSoopersAd', () => {
  describe('2FOR deals', () => {
    it('should parse _KRGR_FINAL COST WUB 2FOR with salePrice correctly', () => {
      // This is the bug case: "4 for $10" was incorrectly parsed as "4 for $5.79"
      const ad = {
        mainlineCopy: 'Coca-Cola Soft Drinks',
        pricingTemplate: '_KRGR_FINAL COST WUB 2FOR',
        salePrice: 10,
        quantity: 4,
        disclaimer: 'Regular retail is up to $5.79 each with Card.',
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('4 for $10');
      expect(result.priceNumber).toBe(2.5);
      expect(result.quantity).toBe(4);
    });

    it('should parse _KRGR_2FOR with retailPrice correctly (no regression)', () => {
      const ad = {
        mainlineCopy: 'Cereal',
        pricingTemplate: '_KRGR_2FOR',
        retailPrice: '5',
        quantity: 2,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $5');
      expect(result.priceNumber).toBe(2.5);
      expect(result.quantity).toBe(2);
    });

    it('should default to quantity 2 for 2FOR when quantity is not specified', () => {
      const ad = {
        mainlineCopy: 'Chips',
        pricingTemplate: '_KRGR_2FOR',
        salePrice: 6,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $6');
      expect(result.priceNumber).toBe(3);
      expect(result.quantity).toBe(2);
    });
  });

  describe('BOGO deals', () => {
    it('should parse _KRGR_BOGO with retailPrice correctly', () => {
      const ad = {
        mainlineCopy: 'Ice Cream',
        pricingTemplate: '_KRGR_BOGO',
        retailPrice: '5.99',
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 Free ($5.99 each)');
      expect(result.priceNumber).toBeCloseTo(2.995);
      expect(result.quantity).toBe(2);
    });

    it('should parse _KRGR_BOGO without price gracefully', () => {
      const ad = {
        mainlineCopy: 'Yogurt',
        pricingTemplate: '_KRGR_BOGO',
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 Free');
      expect(result.priceNumber).toBeNull();
      expect(result.quantity).toBe(2);
    });
  });

  describe('BOGO % deals', () => {
    it('should parse _KRGR_BOGO % with percentOff correctly', () => {
      const ad = {
        mainlineCopy: 'Frozen Pizza',
        pricingTemplate: '_KRGR_BOGO %',
        retailPrice: '8',
        percentOff: 50,
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 50% Off ($8 each)');
      // (8 * 1 + 8 * 0.5) / 2 = 12 / 2 = 6
      expect(result.priceNumber).toBe(6);
      expect(result.quantity).toBe(2);
    });

    it('should parse _KRGR_BOGO % without price gracefully', () => {
      const ad = {
        mainlineCopy: 'Bread',
        pricingTemplate: '_KRGR_BOGO %',
        percentOff: 50,
        buyQuantity: 1,
        getQuantity: 1,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('Buy 1 Get 1 50% Off');
      expect(result.priceNumber).toBeNull();
      expect(result.quantity).toBe(2);
    });
  });

  describe('price fallback behavior', () => {
    it('should prefer salePrice over retailPrice', () => {
      const ad = {
        mainlineCopy: 'Item',
        pricingTemplate: '_KRGR_2FOR',
        salePrice: 10,
        retailPrice: '8',
        quantity: 2,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $10');
      expect(result.priceNumber).toBe(5);
    });

    it('should fallback to retailPrice when salePrice is missing', () => {
      const ad = {
        mainlineCopy: 'Item',
        pricingTemplate: '_KRGR_2FOR',
        retailPrice: '8',
        quantity: 2,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('2 for $8');
      expect(result.priceNumber).toBe(4);
    });

    it('should fallback to disclaimer price when both salePrice and retailPrice are missing', () => {
      const ad = {
        mainlineCopy: 'Item',
        disclaimer: 'Regular retail is up to $7.49 each with Card.',
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('$7.49');
      expect(result.priceNumber).toBe(7.49);
    });

    it('should show "See store for details" when no price is available', () => {
      const ad = {
        mainlineCopy: 'Mystery Item',
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('See store for details');
      expect(result.priceNumber).toBeNull();
    });
  });

  describe('single item price display', () => {
    it('should display single item price correctly', () => {
      const ad = {
        mainlineCopy: 'Milk',
        salePrice: 3.99,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('$3.99');
      expect(result.priceNumber).toBe(3.99);
      expect(result.quantity).toBe(1);
    });

    it('should handle quantity > 1 without 2FOR template', () => {
      const ad = {
        mainlineCopy: 'Cans',
        salePrice: 5,
        quantity: 5,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.priceDisplay).toBe('5 for $5');
      expect(result.priceNumber).toBe(1);
      expect(result.quantity).toBe(5);
    });
  });

  describe('standard deal fields', () => {
    it('should populate all standard deal fields', () => {
      const ad = {
        mainlineCopy: 'Test Product',
        underlineCopy: 'Product details',
        departments: [{ department: 'Grocery' }],
        salePrice: 2.99,
        loyaltyIndicator: 'CARD_REQUIRED',
        images: [{ url: 'https://example.com/image.jpg' }],
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.store).toBe('King Soopers');
      expect(result.name).toBe('Test Product');
      expect(result.details).toBe('Product details');
      expect(result.dept).toBe('Grocery');
      expect(result.loyalty).toBe('CARD_REQUIRED');
      expect(result.image).toBe('https://example.com/image.jpg');
    });

    it('should use description as fallback when underlineCopy is missing', () => {
      const ad = {
        mainlineCopy: 'Test Product',
        description: 'Fallback description',
        salePrice: 1.99,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.details).toBe('Fallback description');
    });

    it('should handle multiple departments', () => {
      const ad = {
        mainlineCopy: 'Multi-dept Item',
        departments: [{ department: 'Grocery' }, { department: 'Bakery' }],
        salePrice: 4.99,
      };

      const result = standardizeKingSoopersAd(ad);

      expect(result.dept).toBe('Grocery, Bakery');
    });
  });
});
