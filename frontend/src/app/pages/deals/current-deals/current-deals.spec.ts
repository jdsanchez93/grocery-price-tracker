import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '@auth0/auth0-angular';
import { CurrentDeals } from './current-deals';
import { DealsService } from '@/app/core/services/deals.service';
import { Deal } from '../../../core/models/deal.model';
import { DealColumnConfig, DealsTable } from '../deals-table/deals-table';
import { makeDeal } from '../../../core/models/test-utils';
import { ROLES_CLAIM } from '@/app/core/auth/auth.constants';

@Component({
  selector: 'app-deals-table',
  template: '',
})
class StubDealsTable {
  deals = input.required<Deal[]>();
  columns = input.required<DealColumnConfig[]>();
  loading = input(false);
  showHistoryLink = input(false);
}

describe('CurrentDeals', () => {
  let component: CurrentDeals;
  let fixture: ComponentFixture<CurrentDeals>;

  const mockDeals = signal<Deal[]>([]);
  const mockLoading = signal(false);
  const mockStoreOptions = signal<{ value: string; label: string }[]>([]);
  const mockDepartmentOptions = signal<{ value: string; label: string }[]>([]);
  let user$: BehaviorSubject<Record<string, unknown> | null | undefined>;

  const mockDealsService = {
    deals: mockDeals.asReadonly(),
    loading: mockLoading.asReadonly(),
    storeOptions: mockStoreOptions.asReadonly(),
    departmentOptions: mockDepartmentOptions.asReadonly(),
  };

  beforeEach(async () => {
    mockDeals.set([]);
    mockLoading.set(false);
    mockStoreOptions.set([]);
    mockDepartmentOptions.set([]);
    user$ = new BehaviorSubject<Record<string, unknown> | null | undefined>(null);

    await TestBed.configureTestingModule({
      imports: [CurrentDeals],
      providers: [
        { provide: DealsService, useValue: mockDealsService },
        { provide: AuthService, useValue: { user$: user$.asObservable() } },
      ],
    })
      .overrideComponent(CurrentDeals, {
        remove: { imports: [DealsTable] },
        add: { imports: [StubDealsTable] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CurrentDeals);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('signals', () => {
    it('should expose deals from service', () => {
      expect(component.deals()).toEqual([]);

      const deals = [makeDeal({ dealId: '1' })];
      mockDeals.set(deals);
      expect(component.deals()).toEqual(deals);
    });

    it('should expose loading from service', () => {
      expect(component.loading()).toBe(false);

      mockLoading.set(true);
      expect(component.loading()).toBe(true);
    });
  });

  describe('columns computed', () => {
    it('should produce 5 columns', () => {
      expect(component.columns().length).toBe(5);
    });

    it('should have correct column fields in order', () => {
      const fields = component.columns().map(c => c.field);
      expect(fields).toEqual(['store', 'name', 'dept', 'priceDisplay', 'loyalty']);
    });

    it('should configure store column with multiselect filter', () => {
      const storeCol = component.columns().find(c => c.field === 'store')!;
      expect(storeCol.sortable).toBe(true);
      expect(storeCol.filterType).toBe('multiselect');
      expect(storeCol.filterField).toBe('storeInstanceId');
    });

    it('should configure name column with text filter', () => {
      const nameCol = component.columns().find(c => c.field === 'name')!;
      expect(nameCol.sortable).toBe(true);
      expect(nameCol.filterType).toBe('text');
    });

    it('should configure dept column with multiselect filter', () => {
      const deptCol = component.columns().find(c => c.field === 'dept')!;
      expect(deptCol.sortable).toBe(true);
      expect(deptCol.filterType).toBe('multiselect');
    });

    it('should configure loyalty column with width style', () => {
      const loyaltyCol = component.columns().find(c => c.field === 'loyalty')!;
      expect(loyaltyCol.style).toEqual({ width: '120px' });
    });

    it('should populate store filterOptions from service', () => {
      const opts = [{ value: 'kingsoopers:a', label: 'King Soopers' }];
      mockStoreOptions.set(opts);

      const storeCol = component.columns().find(c => c.field === 'store')!;
      expect(storeCol.filterOptions).toEqual(opts);
    });

    it('should populate department filterOptions from service', () => {
      const opts = [{ value: 'Produce', label: 'Produce' }];
      mockDepartmentOptions.set(opts);

      const deptCol = component.columns().find(c => c.field === 'dept')!;
      expect(deptCol.filterOptions).toEqual(opts);
    });
  });

  describe('template', () => {
    it('should render app-deals-table', () => {
      expect(fixture.nativeElement.querySelector('app-deals-table')).toBeTruthy();
    });

    it('should pass deals to child component', () => {
      const deals = [makeDeal({ dealId: 'x' })];
      mockDeals.set(deals);
      fixture.detectChanges();

      const tableEl = fixture.nativeElement.querySelector('app-deals-table');
      expect(tableEl).toBeTruthy();
    });
  });

  describe('showHistoryLink', () => {
    it('should be false when user is null', () => {
      user$.next(null);
      fixture.detectChanges();
      expect(component.showHistoryLink()).toBe(false);
    });

    it('should be false when user has no roles', () => {
      user$.next({ [ROLES_CLAIM]: [] });
      fixture.detectChanges();
      expect(component.showHistoryLink()).toBe(false);
    });

    it('should be false when user has an unrelated role', () => {
      user$.next({ [ROLES_CLAIM]: ['viewer'] });
      fixture.detectChanges();
      expect(component.showHistoryLink()).toBe(false);
    });

    it('should be true when user has power_user role', () => {
      user$.next({ [ROLES_CLAIM]: ['power_user'] });
      fixture.detectChanges();
      expect(component.showHistoryLink()).toBe(true);
    });

    it('should be true when user has admin role', () => {
      user$.next({ [ROLES_CLAIM]: ['admin'] });
      fixture.detectChanges();
      expect(component.showHistoryLink()).toBe(true);
    });

    it('should be true when user has both power_user and admin', () => {
      user$.next({ [ROLES_CLAIM]: ['power_user', 'admin'] });
      fixture.detectChanges();
      expect(component.showHistoryLink()).toBe(true);
    });
  });
});
