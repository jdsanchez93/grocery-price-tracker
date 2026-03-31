import { describe, it, expect } from 'vitest';
import { normalizeDept, findCanonicalProductId } from '../../src/scraper/products';

describe('normalizeDept', () => {
  describe('specific departments — no name fallback needed', () => {
    it('PRODUCE → produce', () => {
      expect(normalizeDept('PRODUCE')).toBe('produce');
    });

    it('MEAT → meat', () => {
      expect(normalizeDept('MEAT')).toBe('meat');
    });

    it('SEAFOOD → seafood', () => {
      expect(normalizeDept('SEAFOOD')).toBe('seafood');
    });

    it('DELI/BAKE → deli', () => {
      expect(normalizeDept('DELI/BAKE')).toBe('deli');
    });

    it('Safeway "Dairy, Eggs & Cheese" → dairy', () => {
      expect(normalizeDept('Dairy, Eggs & Cheese')).toBe('dairy');
    });

    it('Safeway "Cookies, Snacks & Candy" → snacks', () => {
      expect(normalizeDept('Cookies, Snacks & Candy')).toBe('snacks');
    });
  });

  describe('GM / DRUG/GM — intentional general merchandise, no name fallback', () => {
    it('GM → general', () => {
      expect(normalizeDept('GM')).toBe('general');
    });

    it('DRUG/GM → general', () => {
      expect(normalizeDept('DRUG/GM')).toBe('general');
    });

    it('DRUG/GM with Easter egg candy name → general (not dairy)', () => {
      expect(normalizeDept('DRUG/GM', 'Cadbury Mini Eggs')).toBe('general');
    });

    it('GM with Easter basket name → general', () => {
      expect(normalizeDept('GM', 'Holiday Home Easter Baskets')).toBe('general');
    });
  });

  describe('GROCERY — name fallback fires', () => {
    it('GROCERY + ice cream name → frozen', () => {
      expect(normalizeDept('GROCERY', 'Häagen-Dazs Ice Cream')).toBe('frozen');
    });

    it('GROCERY + chip name → snacks', () => {
      expect(normalizeDept("GROCERY", "Lay's Potato Chips")).toBe('snacks');
    });

    it('GROCERY + brand-only chip name → pantry (fallback finds no match)', () => {
      expect(normalizeDept('GROCERY', 'Ruffles')).toBe('pantry');
    });

    it('GROCERY + seltzer name → beverages', () => {
      expect(normalizeDept('GROCERY', 'Polar Seltzer Water')).toBe('beverages');
    });

    it('GROCERY + Coca-Cola brand name → beverages', () => {
      expect(normalizeDept('GROCERY', 'Coca-Cola')).toBe('beverages');
    });

    it('GROCERY + bundled Pepsi/7UP deal name → beverages', () => {
      expect(normalizeDept('GROCERY', 'Pepsi or 7UP')).toBe('beverages');
    });

    it('GROCERY + pasta name → pantry (fallback finds no match, stays pantry)', () => {
      expect(normalizeDept('GROCERY', 'Kroger Pasta')).toBe('pantry');
    });
  });

  describe('NATURAL FOODS — treated as grocery-like, name fallback fires', () => {
    it("NATURAL FOODS + chip name → snacks", () => {
      expect(normalizeDept('NATURAL FOODS', "Miss Vickie's Kettle Cooked Potato Chips")).toBe('snacks');
    });
  });

  describe('multi-dept — most specific wins; GROCERY triggers fallback', () => {
    it('DRUG/GM, GROCERY + snack name → snacks (GROCERY triggers fallback)', () => {
      expect(normalizeDept('DRUG/GM, GROCERY', 'Nabisco Snack Crackers')).toBe('snacks');
    });

    it('specific dept wins immediately over generic', () => {
      expect(normalizeDept('GROCERY, PRODUCE', 'Bananas')).toBe('produce');
    });
  });
});

describe('findCanonicalProductId', () => {
  describe('ice cream', () => {
    it('matches KS GROCERY ice cream via name fallback', () => {
      expect(findCanonicalProductId('Häagen-Dazs Ice Cream', undefined, 'GROCERY')).toBe('ice-cream');
    });

    it('matches Safeway ice cream in Dairy dept', () => {
      expect(findCanonicalProductId('Signature SELECT Ice Cream', 'select varieties', 'Dairy, Eggs & Cheese')).toBe('ice-cream');
    });

    it('does not match Easter egg candy in DRUG/GM dept', () => {
      expect(findCanonicalProductId('Cadbury Mini Eggs', undefined, 'DRUG/GM')).toBeUndefined();
    });
  });

  describe('chips', () => {
    it('matches KS Lay\'s via GROCERY name fallback', () => {
      expect(findCanonicalProductId("Lay's Potato Chips", undefined, 'GROCERY')).toBe('chips');
    });

    it('matches KS Ruffles (brand-only name, no "chip") via pantry deptIn', () => {
      expect(findCanonicalProductId('Ruffles', undefined, 'GROCERY')).toBe('chips');
    });

    it('matches Safeway Doritos via snacks dept', () => {
      expect(findCanonicalProductId('Doritos Tortilla Chips', undefined, 'Cookies, Snacks & Candy')).toBe('chips');
    });

    it('matches KS Miss Vickie\'s via NATURAL FOODS + name fallback', () => {
      expect(findCanonicalProductId("Miss Vickie's Kettle Cooked Potato Chips", undefined, 'NATURAL FOODS')).toBe('chips');
    });
  });

  describe('soda', () => {
    it('matches KS Coca-Cola via GROCERY name fallback', () => {
      expect(findCanonicalProductId('Coca-Cola', undefined, 'GROCERY')).toBe('soda');
    });

    it('matches KS bundled Pepsi/7UP deal', () => {
      expect(findCanonicalProductId('Pepsi or 7UP', undefined, 'GROCERY')).toBe('soda');
    });

    it('matches standalone 7UP', () => {
      expect(findCanonicalProductId('7UP', undefined, 'GROCERY')).toBe('soda');
    });

    it('matches Safeway soda via beverages dept', () => {
      expect(findCanonicalProductId('Coca-Cola, Pepsi, 7-Up Soft Drinks', undefined, 'Beverages')).toBe('soda');
    });
  });

  describe('dept filtering prevents false positives', () => {
    it('eggs in DRUG/GM do not match egg canonical product', () => {
      expect(findCanonicalProductId('Kinder Joy Egg', undefined, 'DRUG/GM')).toBeUndefined();
    });

    it('potatoes in snacks dept do not match produce potatoes', () => {
      expect(findCanonicalProductId('Kettle Brand Potato Chips', undefined, 'Cookies, Snacks & Candy')).toBe('chips');
    });
  });
});
