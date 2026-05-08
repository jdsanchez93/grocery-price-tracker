import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Deal, DealRating } from '@/app/core/models/deal.model';
import { makeDeal } from '@/app/core/models/test-utils';
import { DealsService } from '@/app/core/services/deals.service';
import { DealRatingBadge } from '@/app/shared/components/deal-rating-badge/deal-rating-badge';
import { TopDealsWidget } from './top-deals-widget';

@Component({ selector: 'app-deal-rating-badge', template: '' })
class StubDealRatingBadge {
  rating = input.required<DealRating>();
}

function makeRating(overrides: Partial<DealRating> = {}): DealRating {
  return {
    label: 'good',
    percentVsAvg: -15,
    historicalAvg: 2.99,
    historicalMin: 1.99,
    sampleSize: 5,
    ...overrides,
  };
}

describe('TopDealsWidget', () => {
  const deals = signal<Deal[]>([]);

  function setup() {
    TestBed.configureTestingModule({
      providers: [{ provide: DealsService, useValue: { deals: deals.asReadonly() } }],
    })
      .overrideComponent(TopDealsWidget, {
        remove: { imports: [DealRatingBadge] },
        add: { imports: [StubDealRatingBadge] },
      });
    return TestBed.createComponent(TopDealsWidget);
  }

  beforeEach(() => deals.set([]));

  it('should create', () => {
    expect(setup().componentInstance).toBeTruthy();
  });

  describe('topDeals computed', () => {
    it('should return empty array when no deals', () => {
      expect(setup().componentInstance.topDeals()).toEqual([]);
    });

    it('should exclude unrated deals', () => {
      deals.set([makeDeal({ dealId: '1' })]);
      expect(setup().componentInstance.topDeals()).toEqual([]);
    });

    it('should exclude typical and high rated deals', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'typical' }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'high' }) }),
      ]);
      expect(setup().componentInstance.topDeals()).toEqual([]);
    });

    it('should include best and good rated deals', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'best' }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'good' }) }),
      ]);
      const result = setup().componentInstance.topDeals();
      expect(result.length).toBe(2);
    });

    it('should sort best before good', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'good', percentVsAvg: -20 }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'best', percentVsAvg: -5 }) }),
      ]);
      const result = setup().componentInstance.topDeals();
      expect(result[0].dealId).toBe('2');
      expect(result[1].dealId).toBe('1');
    });

    it('should sort by percentVsAvg ascending within the same label', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating({ label: 'good', percentVsAvg: -10 }) }),
        makeDeal({ dealId: '2', rating: makeRating({ label: 'good', percentVsAvg: -25 }) }),
        makeDeal({ dealId: '3', rating: makeRating({ label: 'good', percentVsAvg: -15 }) }),
      ]);
      const ids = setup().componentInstance.topDeals().map(d => d.dealId);
      expect(ids).toEqual(['2', '3', '1']);
    });
  });

  describe('template', () => {
    it('should show empty state when no qualifying deals', () => {
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No deals loaded yet');
    });

    it('should not show list in empty state', () => {
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('ul')).toBeFalsy();
    });

    it('should render one list item per qualifying deal', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating() }),
        makeDeal({ dealId: '2', rating: makeRating() }),
        makeDeal({ dealId: '3', rating: makeRating() }),
      ]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('li').length).toBe(3);
    });

    it('should render deal name and price', () => {
      deals.set([makeDeal({ dealId: '1', name: 'Organic Apples', priceDisplay: '$3.99/lb', rating: makeRating() })]);
      const fixture = setup();
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Organic Apples');
      expect(text).toContain('$3.99/lb');
    });

    it('should render deal details when present', () => {
      deals.set([makeDeal({ dealId: '1', details: 'Buy 1 Get 1 Free', rating: makeRating() })]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Buy 1 Get 1 Free');
    });

    it('should render a rating badge per deal', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating() }),
        makeDeal({ dealId: '2', rating: makeRating() }),
      ]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('app-deal-rating-badge').length).toBe(2);
    });

    it('should render n-1 dividers for n deals', () => {
      deals.set([
        makeDeal({ dealId: '1', rating: makeRating() }),
        makeDeal({ dealId: '2', rating: makeRating() }),
        makeDeal({ dealId: '3', rating: makeRating() }),
      ]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p-divider').length).toBe(2);
    });

    it('should not render a divider for a single deal', () => {
      deals.set([makeDeal({ dealId: '1', rating: makeRating() })]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p-divider').length).toBe(0);
    });
  });
});
