import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DealRating, RatedDeal } from '@/app/core/models/deal.model';
import { makeDeal } from '@/app/core/models/test-utils';
import { DealsService } from '@/app/core/services/deals.service';
import { DealRatingBadge } from '@/app/shared/components/deal-rating-badge/deal-rating-badge';
import { TopDealsWidget, TOP_DEALS_WIDGET_LIMIT } from './top-deals-widget';

@Component({ selector: 'app-deal-rating-badge', template: '' })
class StubDealRatingBadge {
  rating = input.required<DealRating>();
  productId = input<string>();
  productName = input<string>();
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

function makeRatedDeal(dealId: string, overrides: Partial<RatedDeal> = {}): RatedDeal {
  return { ...makeDeal({ dealId }), rating: makeRating(), ...overrides };
}

describe('TopDealsWidget', () => {
  const topDeals = signal<RatedDeal[]>([]);
  const loading = signal(false);

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DealsService, useValue: { topDeals: topDeals.asReadonly(), loading: loading.asReadonly() } },
      ],
    })
      .overrideComponent(TopDealsWidget, {
        remove: { imports: [DealRatingBadge] },
        add: { imports: [StubDealRatingBadge] },
      });
    return TestBed.createComponent(TopDealsWidget);
  }

  beforeEach(() => {
    topDeals.set([]);
    loading.set(false);
  });

  it('should create', () => {
    expect(setup().componentInstance).toBeTruthy();
  });

  describe('topDeals limit', () => {
    it('should show all deals when at or under the limit', () => {
      topDeals.set([makeRatedDeal('1'), makeRatedDeal('2')]);
      expect(setup().componentInstance.topDeals().length).toBe(2);
    });

    it('should cap the list at the widget limit', () => {
      topDeals.set(Array.from({ length: TOP_DEALS_WIDGET_LIMIT + 3 }, (_, i) => makeRatedDeal(`${i}`)));
      expect(setup().componentInstance.topDeals().length).toBe(TOP_DEALS_WIDGET_LIMIT);
    });

    it('should keep the first deals from the service ordering', () => {
      topDeals.set(Array.from({ length: TOP_DEALS_WIDGET_LIMIT + 2 }, (_, i) => makeRatedDeal(`${i}`)));
      const ids = setup().componentInstance.topDeals().map(d => d.dealId);
      expect(ids).toEqual(['0', '1', '2', '3', '4']);
    });
  });

  describe('view-all link', () => {
    it('should render the link with the total count when deals exist', () => {
      topDeals.set(Array.from({ length: 7 }, (_, i) => makeRatedDeal(`${i}`)));
      const fixture = setup();
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('a');
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('View all 7');
      expect(link.getAttribute('href')).toBe('/deals/top-deals');
    });

    it('should not render the link when there are no top deals', () => {
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('a')).toBeFalsy();
    });

    it('should not render the link while loading', () => {
      loading.set(true);
      topDeals.set([makeRatedDeal('1')]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('a')).toBeFalsy();
    });
  });

  describe('template', () => {
    it('should show skeletons instead of empty state while loading', () => {
      loading.set(true);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
      expect(fixture.nativeElement.textContent).not.toContain('No deals loaded yet');
    });

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

    it('should render one list item per deal up to the limit', () => {
      topDeals.set(Array.from({ length: TOP_DEALS_WIDGET_LIMIT + 2 }, (_, i) => makeRatedDeal(`${i}`)));
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('li').length).toBe(TOP_DEALS_WIDGET_LIMIT);
    });

    it('should render deal name and price', () => {
      topDeals.set([makeRatedDeal('1', { name: 'Organic Apples', priceDisplay: '$3.99/lb' })]);
      const fixture = setup();
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Organic Apples');
      expect(text).toContain('$3.99/lb');
    });

    it('should render deal details when present', () => {
      topDeals.set([makeRatedDeal('1', { details: 'Buy 1 Get 1 Free' })]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Buy 1 Get 1 Free');
    });

    it('should render a rating badge per deal', () => {
      topDeals.set([makeRatedDeal('1'), makeRatedDeal('2')]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('app-deal-rating-badge').length).toBe(2);
    });

    it('should render n-1 dividers for n deals', () => {
      topDeals.set([makeRatedDeal('1'), makeRatedDeal('2'), makeRatedDeal('3')]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p-divider').length).toBe(2);
    });

    it('should not render a divider for a single deal', () => {
      topDeals.set([makeRatedDeal('1')]);
      const fixture = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('p-divider').length).toBe(0);
    });
  });
});
