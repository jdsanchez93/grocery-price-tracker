import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Deal, DealRating } from '@/app/core/models/deal.model';
import { makeDeal } from '@/app/core/models/test-utils';
import { DealRatingBadge } from '@/app/shared/components/deal-rating-badge/deal-rating-badge';
import { DealsList } from './deals-list';

@Component({ selector: 'app-deal-rating-badge', template: '' })
class StubDealRatingBadge {
  rating = input.required<DealRating>();
  productId = input<string>();
  productName = input<string>();
}

function makeRating(overrides: Partial<DealRating> = {}): DealRating {
  return {
    label: 'good',
    percentVsAvg: -10,
    historicalAvg: 2.99,
    historicalMin: 1.99,
    sampleSize: 5,
    ...overrides,
  };
}

describe('DealsList', () => {
  function setup(deals: Deal[], showRating = false) {
    TestBed.configureTestingModule({})
      .overrideComponent(DealsList, {
        remove: { imports: [DealRatingBadge] },
        add: { imports: [StubDealRatingBadge] },
      });
    const fixture = TestBed.createComponent(DealsList);
    fixture.componentRef.setInput('deals', deals);
    fixture.componentRef.setInput('showRating', showRating);
    return fixture;
  }

  describe('visibleDeals — filtering', () => {
    it('returns all deals when the search query is empty', () => {
      const deals = [makeDeal({ dealId: '1' }), makeDeal({ dealId: '2' })];
      const fixture = setup(deals);
      expect(fixture.componentInstance.visibleDeals()).toHaveLength(2);
    });

    it('filters by name (case-insensitive)', () => {
      const deals = [
        makeDeal({ dealId: '1', name: 'Apples' }),
        makeDeal({ dealId: '2', name: 'Bananas' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('app');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['1']);
    });

    it('filters by details', () => {
      const deals = [
        makeDeal({ dealId: '1', details: '12-pack' }),
        makeDeal({ dealId: '2', details: '2-liter' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('pack');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['1']);
    });

    it('filters by department', () => {
      const deals = [
        makeDeal({ dealId: '1', dept: 'Produce' }),
        makeDeal({ dealId: '2', dept: 'Dairy' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('dairy');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2']);
    });

    it('filters by store display name', () => {
      const deals = [
        makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:a' }),
        makeDeal({ dealId: '2', storeInstanceId: 'safeway:b' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('safeway');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2']);
    });

    it('filters by canonicalProductId (case-insensitive)', () => {
      const deals = [
        makeDeal({ dealId: '1', name: 'Pepsi 12-Pack', canonicalProductId: 'soda-pepsi-12pack' }),
        makeDeal({ dealId: '2', name: 'Orange Juice', canonicalProductId: 'juice-oj' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('soda');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['1']);
    });

    it('matches canonicalProductId even when name does not match', () => {
      const deals = [
        makeDeal({ dealId: '1', name: 'Cola 12-Pack', canonicalProductId: 'soda-cola-12pack' }),
        makeDeal({ dealId: '2', name: 'Milk', canonicalProductId: 'dairy-milk' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('dairy');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2']);
    });

    it('treats deals with undefined canonicalProductId as non-matches without erroring', () => {
      const deals = [
        makeDeal({ dealId: '1', name: 'Apples', canonicalProductId: undefined }),
        makeDeal({ dealId: '2', name: 'Soda', canonicalProductId: 'soda-pepsi' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('soda');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2']);
    });

    it('returns no deals when nothing matches', () => {
      const deals = [makeDeal({ dealId: '1', name: 'Apples' })];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('zzz');
      expect(fixture.componentInstance.visibleDeals()).toHaveLength(0);
    });

    it('treats deals with undefined name/details as non-matches without erroring', () => {
      const deals = [
        makeDeal({ dealId: '1', name: undefined, details: undefined }),
        makeDeal({ dealId: '2', name: 'Apples' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.searchQuery.set('apple');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2']);
    });
  });

  describe('visibleDeals — sorting', () => {
    it('sorts by price ascending', () => {
      const deals = [
        makeDeal({ dealId: '1', priceNumber: 5.0 }),
        makeDeal({ dealId: '2', priceNumber: 1.99 }),
        makeDeal({ dealId: '3', priceNumber: 3.0 }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.sortKey.set('price-asc');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2', '3', '1']);
    });

    it('sorts by price descending', () => {
      const deals = [
        makeDeal({ dealId: '1', priceNumber: 5.0 }),
        makeDeal({ dealId: '2', priceNumber: 1.99 }),
        makeDeal({ dealId: '3', priceNumber: 3.0 }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.sortKey.set('price-desc');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['1', '3', '2']);
    });

    it('sorts by name A→Z', () => {
      const deals = [
        makeDeal({ dealId: '1', name: 'Cherries' }),
        makeDeal({ dealId: '2', name: 'Apples' }),
        makeDeal({ dealId: '3', name: 'Bananas' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.sortKey.set('name');
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2', '3', '1']);
    });

    it('sorts by store display name', () => {
      const deals = [
        makeDeal({ dealId: '1', storeInstanceId: 'sprouts:a' }),
        makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:b' }),
      ];
      const fixture = setup(deals);
      fixture.componentInstance.sortKey.set('store');
      // King Soopers (K) before Sprouts (S)
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['2', '1']);
    });

    it('sorts by rating: best label first, then by percentVsAvg, then unrated last', () => {
      const deals = [
        makeDeal({ dealId: '1', rating: makeRating({ label: 'good', percentVsAvg: -5 }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'best', percentVsAvg: -30 }) }),
        makeDeal({ dealId: '3', rating: makeRating({ label: 'best', percentVsAvg: -50 }) }),
        makeDeal({ dealId: '4' }), // no rating
      ];
      const fixture = setup(deals, true);
      fixture.componentInstance.sortKey.set('rating');
      // best -50 < best -30 < good -5 < unrated
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['3', '2', '1', '4']);
    });

    it('does not mutate the input deals array when sorting', () => {
      const deals = [
        makeDeal({ dealId: '1', priceNumber: 5.0 }),
        makeDeal({ dealId: '2', priceNumber: 1.99 }),
      ];
      const originalOrder = deals.map(d => d.dealId);
      const fixture = setup(deals);
      fixture.componentInstance.sortKey.set('price-asc');
      fixture.componentInstance.visibleDeals();
      expect(deals.map(d => d.dealId)).toEqual(originalOrder);
    });

    it('returns deals in original order when sortKey is null', () => {
      const deals = [
        makeDeal({ dealId: '1', priceNumber: 5.0 }),
        makeDeal({ dealId: '2', priceNumber: 1.99 }),
      ];
      const fixture = setup(deals);
      expect(fixture.componentInstance.visibleDeals().map(d => d.dealId)).toEqual(['1', '2']);
    });
  });

  describe('sortOptions', () => {
    it('omits the "rating" option when showRating is false', () => {
      const fixture = setup([], false);
      const values = fixture.componentInstance.sortOptions().map(o => o.value);
      expect(values).not.toContain('rating');
    });

    it('includes "rating" as the first option when showRating is true', () => {
      const fixture = setup([], true);
      expect(fixture.componentInstance.sortOptions()[0].value).toBe('rating');
    });
  });

  describe('expanded state', () => {
    it('starts with all deals collapsed', () => {
      const fixture = setup([makeDeal({ dealId: '1' })]);
      expect(fixture.componentInstance.isExpanded('1')).toBe(false);
    });

    it('toggles a deal between expanded and collapsed', () => {
      const fixture = setup([makeDeal({ dealId: '1' })]);
      fixture.componentInstance.toggleExpand('1');
      expect(fixture.componentInstance.isExpanded('1')).toBe(true);
      fixture.componentInstance.toggleExpand('1');
      expect(fixture.componentInstance.isExpanded('1')).toBe(false);
    });

    it('tracks expansion state independently for each deal', () => {
      const fixture = setup([makeDeal({ dealId: '1' }), makeDeal({ dealId: '2' })]);
      fixture.componentInstance.toggleExpand('1');
      expect(fixture.componentInstance.isExpanded('1')).toBe(true);
      expect(fixture.componentInstance.isExpanded('2')).toBe(false);
    });
  });

  describe('variant helpers', () => {
    it('hasPerLb is true when any variant has perLb', () => {
      const fixture = setup([]);
      const deal = makeDeal({
        priceVariants: [
          { price: 1.99, example: 'A' },
          { price: 2.99, example: 'B', perLb: 4.5 },
        ],
      });
      expect(fixture.componentInstance.hasPerLb(deal)).toBe(true);
    });

    it('hasPerLb is false when no variant has perLb', () => {
      const fixture = setup([]);
      const deal = makeDeal({ priceVariants: [{ price: 1.99, example: 'A' }] });
      expect(fixture.componentInstance.hasPerLb(deal)).toBe(false);
    });

    it('hasPerLb is false when priceVariants is absent', () => {
      const fixture = setup([]);
      expect(fixture.componentInstance.hasPerLb(makeDeal())).toBe(false);
    });

    it('hasAvgWeight is true when any variant has avgWeight', () => {
      const fixture = setup([]);
      const deal = makeDeal({
        priceVariants: [{ price: 1.99, example: 'A', avgWeight: 0.5 }],
      });
      expect(fixture.componentInstance.hasAvgWeight(deal)).toBe(true);
    });

    it('hasAvgWeight is false when no variant has avgWeight', () => {
      const fixture = setup([]);
      const deal = makeDeal({ priceVariants: [{ price: 1.99, example: 'A' }] });
      expect(fixture.componentInstance.hasAvgWeight(deal)).toBe(false);
    });
  });
});
