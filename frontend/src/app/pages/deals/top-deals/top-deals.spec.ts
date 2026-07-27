import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { TopDeals } from './top-deals';
import { DealsService } from '@/app/core/services/deals.service';
import { LayoutService } from '@/app/layout/service/layout.service';
import { Deal, RatedDeal } from '../../../core/models/deal.model';
import { DealColumnConfig, DealsTable } from '../deals-table/deals-table';
import { DealsList } from '../deals-list/deals-list';
import { makeDeal } from '../../../core/models/test-utils';

@Component({
  selector: 'app-deals-table',
  template: '',
})
class StubDealsTable {
  deals = input.required<Deal[]>();
  columns = input.required<DealColumnConfig[]>();
  loading = input(false);
}

@Component({
  selector: 'app-deals-list',
  template: '',
})
class StubDealsList {
  deals = input.required<Deal[]>();
  loading = input(false);
  showRating = input(false);
}

function makeRatedDeal(dealId: string): RatedDeal {
  return {
    ...makeDeal({ dealId }),
    rating: { label: 'best', percentVsAvg: -20, historicalAvg: 2.99, historicalMin: 1.99, sampleSize: 5 },
  };
}

describe('TopDeals', () => {
  let component: TopDeals;
  let fixture: ComponentFixture<TopDeals>;

  const mockTopDeals = signal<RatedDeal[]>([]);
  const mockLoading = signal(false);
  const mockIsMobile = signal(false);

  const mockDealsService = {
    topDeals: mockTopDeals.asReadonly(),
    loading: mockLoading.asReadonly(),
  };

  const mockLayoutService = {
    isMobile$: mockIsMobile.asReadonly(),
  };

  beforeEach(async () => {
    mockTopDeals.set([]);
    mockLoading.set(false);
    mockIsMobile.set(false);

    await TestBed.configureTestingModule({
      imports: [TopDeals],
      providers: [
        { provide: DealsService, useValue: mockDealsService },
        { provide: LayoutService, useValue: mockLayoutService },
      ],
    })
      .overrideComponent(TopDeals, {
        remove: { imports: [DealsTable, DealsList] },
        add: { imports: [StubDealsTable, StubDealsList] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TopDeals);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('signals', () => {
    it('should expose topDeals from service', () => {
      expect(component.topDeals()).toEqual([]);

      const deals = [makeRatedDeal('1')];
      mockTopDeals.set(deals);
      expect(component.topDeals()).toEqual(deals);
    });

    it('should expose loading from service', () => {
      expect(component.loading()).toBe(false);

      mockLoading.set(true);
      expect(component.loading()).toBe(true);
    });
  });

  describe('columns computed', () => {
    it('should have correct column fields in order, including rating', () => {
      const fields = component.columns().map(c => c.field);
      expect(fields).toEqual(['store', 'name', 'dept', 'priceDisplay', 'loyalty', 'rating']);
    });

    it('should always include the rating column', () => {
      expect(component.columns().map(c => c.field)).toContain('rating');
    });
  });

  describe('template', () => {
    it('should render a heading', () => {
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Top Deals');
    });

    it('should render app-deals-table on desktop', () => {
      expect(fixture.nativeElement.querySelector('app-deals-table')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-deals-list')).toBeFalsy();
    });

    it('should render app-deals-list on mobile', () => {
      mockIsMobile.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-deals-list')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-deals-table')).toBeFalsy();
    });
  });
});
