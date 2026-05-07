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

  describe('soda — format-aware', () => {
    it('KS 12-Pack 12 fl oz Cans → soda:12x12oz-can', () => {
      expect(findCanonicalProductId('Coca-Cola', '12-Pack, 12 fl oz Cans', 'GROCERY')).toBe('soda:12x12oz-can');
    });
    it('Safeway 24 pk 12 oz cans → soda:24x12oz-can', () => {
      expect(findCanonicalProductId('Coca-Cola Products', '24 pk, 12 oz cans, select varieties', 'Beverages')).toBe('soda:24x12oz-can');
    });
    it('Safeway 6 pk 7.5 oz mini cans → soda:6x7.5oz-can', () => {
      expect(findCanonicalProductId('Coca-Cola Soft Drinks', '6 pk, 7.5 oz cans, select varieties', 'Beverages')).toBe('soda:6x7.5oz-can');
    });
    it('Safeway 10 pk 7.5 oz mini cans → soda:10x7.5oz-can', () => {
      expect(findCanonicalProductId('Coca-Cola Soft Drinks', '10 pk, 7.5 oz cans', 'Beverages')).toBe('soda:10x7.5oz-can');
    });
    it('2-liter → soda:2l', () => {
      expect(findCanonicalProductId('Pepsi', '2 Liter Bottle', 'Beverages')).toBe('soda:2l');
    });
    it('20 oz single → soda:20oz', () => {
      expect(findCanonicalProductId('Dr Pepper', '20 fl oz', 'Beverages')).toBe('soda:20oz');
    });
    it('no size info → flat soda (fallback)', () => {
      expect(findCanonicalProductId('Coca-Cola', undefined, 'GROCERY')).toBe('soda');
    });
  });

  describe('eggs — format-aware', () => {
    it('18-count → eggs:18ct', () => {
      expect(findCanonicalProductId('Large Eggs', '18-Count', 'Dairy, Eggs & Cheese')).toBe('eggs:18ct');
    });
    it('1 dozen → eggs:12ct', () => {
      expect(findCanonicalProductId('Large Eggs', '1 Dozen', 'Dairy, Eggs & Cheese')).toBe('eggs:12ct');
    });
    it('2 dozen → eggs:24ct', () => {
      expect(findCanonicalProductId('Large Eggs', '2 Dozen', 'Dairy, Eggs & Cheese')).toBe('eggs:24ct');
    });
    it('no size info → flat eggs', () => {
      expect(findCanonicalProductId('Large Eggs', undefined, 'Dairy, Eggs & Cheese')).toBe('eggs');
    });
  });

  describe('milk — format-aware', () => {
    it('gallon → milk:gal', () => {
      expect(findCanonicalProductId('Whole Milk', '1 Gallon', 'Dairy, Eggs & Cheese')).toBe('milk:gal');
    });
    it('half-gallon → milk:half-gal', () => {
      expect(findCanonicalProductId('2% Milk', 'Half Gallon', 'Dairy, Eggs & Cheese')).toBe('milk:half-gal');
    });
    it('no size info → flat milk', () => {
      expect(findCanonicalProductId('Whole Milk', undefined, 'Dairy, Eggs & Cheese')).toBe('milk');
    });
  });

  describe('chips — format-aware', () => {
    it('Party Size in name → chips:party', () => {
      expect(findCanonicalProductId("Lay's Party Size Potato Chips", 'Select Varieties, 12.5-13 oz', 'GROCERY')).toBe('chips:party');
    });
    it('Party Size in details → chips:party', () => {
      expect(findCanonicalProductId('Ruffles', 'Party-Size bag', 'GROCERY')).toBe('chips:party');
    });
    it('Safeway select sizes and varieties → flat chips', () => {
      expect(findCanonicalProductId("Lay's, Doritos, Sunchips, Tostitos & Dips", 'select sizes and varieties', 'Cookies, Snacks & Candy')).toBe('chips');
    });
    it('KS multi-oz OR list → flat chips', () => {
      expect(findCanonicalProductId('Doritos', '9-10.75 oz or Ruffles, 7.25-10.25 oz or Sunchips, 7 oz; Select Varieties', 'GROCERY')).toBe('chips');
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
