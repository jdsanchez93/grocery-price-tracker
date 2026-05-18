import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProductHistory } from './product-history';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { Deal } from '../../../core/models/deal.model';
import { DealColumnConfig, DealsTable } from '../../deals/deals-table/deals-table';
import { PriceTrendChart } from './price-trend-chart/price-trend-chart';
import { makeDeal } from '../../../core/models/test-utils';

@Component({ selector: 'app-deals-table', template: '' })
class StubDealsTable {
  deals = input.required<Deal[]>();
  columns = input.required<DealColumnConfig[]>();
  loading = input(false);
  rows = input(20);
}

@Component({ selector: 'app-price-trend-chart', template: '' })
class StubPriceTrendChart {
  history = input.required<Deal[]>();
}

function makeRoute(id: string) {
  return {
    snapshot: { paramMap: { get: (key: string) => (key === 'id' ? id : null) } },
  };
}

describe('ProductHistory', () => {
  let component: ProductHistory;
  let fixture: ComponentFixture<ProductHistory>;
  let analyticsService: { getProductHistory: ReturnType<typeof vi.fn> };

  const deal1 = makeDeal({ dealId: 'd1', storeInstanceId: 'kingsoopers:abc', weekId: '2026-W10', canonicalProductId: 'chicken-breast' });
  const deal2 = makeDeal({ dealId: 'd2', storeInstanceId: 'safeway:xyz', weekId: '2026-W14', canonicalProductId: 'chicken-breast' });

  async function setup(productId = 'chicken-breast', resolveWith?: { history: Deal[]; count: number }) {
    analyticsService = {
      getProductHistory: vi.fn().mockReturnValue(
        resolveWith !== undefined
          ? of({ productId, history: resolveWith.history, count: resolveWith.count })
          : of({ productId, history: [], count: 0 })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ProductHistory],
      providers: [
        { provide: ActivatedRoute, useValue: makeRoute(productId) },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    })
      .overrideComponent(ProductHistory, {
        remove: { imports: [DealsTable, PriceTrendChart] },
        add: { imports: [StubDealsTable, StubPriceTrendChart] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProductHistory);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  describe('initialization', () => {
    it('should set productId from route param', async () => {
      await setup('eggs');
      expect(component.productId()).toBe('eggs');
    });

    it('should call getProductHistory with the route param id', async () => {
      await setup('chicken-breast');
      expect(analyticsService.getProductHistory).toHaveBeenCalledWith('chicken-breast');
    });

    it('should set loading to false after history loads', async () => {
      await setup();
      expect(component.loading()).toBe(false);
    });

    it('should populate history signal from response', async () => {
      await setup('chicken-breast', { history: [deal1, deal2], count: 2 });
      expect(component.history()).toEqual([deal1, deal2]);
    });

    it('should set error and stop loading on API failure', async () => {
      analyticsService = { getProductHistory: vi.fn().mockReturnValue(throwError(() => new Error('500'))) };

      await TestBed.configureTestingModule({
        imports: [ProductHistory],
        providers: [
          { provide: ActivatedRoute, useValue: makeRoute('chicken-breast') },
          { provide: AnalyticsService, useValue: analyticsService },
        ],
      })
        .overrideComponent(ProductHistory, {
          remove: { imports: [DealsTable] },
          add: { imports: [StubDealsTable] },
        })
        .compileComponents();

      fixture = TestBed.createComponent(ProductHistory);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.error()).toMatch(/failed/i);
      expect(component.loading()).toBe(false);
    });
  });


  describe('columns computed', () => {
    it('should have 5 columns', async () => {
      await setup();
      expect(component.columns().length).toBe(5);
    });

    it('should include rating column with navigable=false', async () => {
      await setup();
      const ratingCol = component.columns().find(c => c.field === 'rating');
      expect(ratingCol).toBeTruthy();
      expect(ratingCol?.navigable).toBe(false);
    });

    it('should have weekId as first column', async () => {
      await setup();
      expect(component.columns()[0].field).toBe('weekId');
    });

    it('should configure store column with multiselect filter', async () => {
      await setup();
      const storeCol = component.columns().find(c => c.field === 'store')!;
      expect(storeCol.filterType).toBe('multiselect');
      expect(storeCol.filterField).toBe('storeInstanceId');
    });

    it('should configure store column with storeInstanceId as filter field', async () => {
      await setup();
      const storeCol = component.columns().find(c => c.field === 'store')!;
      expect(storeCol.filterField).toBe('storeInstanceId');
    });
  });

  describe('template', () => {
    it('should show product id', async () => {
      await setup('salmon');
      expect(fixture.nativeElement.textContent).toContain('salmon');
    });

    it('should render deals table when no error', async () => {
      await setup();
      expect(fixture.nativeElement.querySelector('app-deals-table')).toBeTruthy();
    });

    it('should show error message and hide table when error occurs', async () => {
      analyticsService = { getProductHistory: vi.fn().mockReturnValue(throwError(() => new Error())) };
      await TestBed.configureTestingModule({
        imports: [ProductHistory],
        providers: [
          { provide: ActivatedRoute, useValue: makeRoute('salmon') },
          { provide: AnalyticsService, useValue: analyticsService },
        ],
      })
        .overrideComponent(ProductHistory, {
          remove: { imports: [DealsTable] },
          add: { imports: [StubDealsTable] },
        })
        .compileComponents();

      fixture = TestBed.createComponent(ProductHistory);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-deals-table')).toBeFalsy();
    });
  });
});
