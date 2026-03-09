import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StatsWidget } from './stats-widget';
import { DealsService } from '@/app/core/services/deals.service';
import { StoresService } from '@/app/core/services/stores.service';
import { makeDeal } from '@/app/core/models/deal.model.spec';
import { Deal } from '@/app/core/models/deal.model';
import { UserStore } from '@/app/core/models/store.model';

function makeUserStore(overrides: Partial<UserStore> = {}): UserStore {
  return {
    instanceId: 'kingsoopers:abc',
    name: 'Test Store',
    storeType: 'kingsoopers',
    chain: 'kroger',
    addedAt: '2026-01-01',
    ...overrides,
  };
}

describe('StatsWidget', () => {
  const deals = signal<Deal[]>([]);
  const departments = signal<string[]>([]);
  const userStores = signal<UserStore[]>([]);

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DealsService,
          useValue: { deals: deals.asReadonly(), departments: departments.asReadonly() },
        },
        {
          provide: StoresService,
          useValue: { getUserStores: userStores.asReadonly() },
        },
      ],
    });
    return TestBed.createComponent(StatsWidget);
  }

  beforeEach(() => {
    deals.set([]);
    departments.set([]);
    userStores.set([]);
  });

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show zero counts when no data', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    expect(component.totalDeals()).toBe(0);
    expect(component.storesTracked()).toBe(0);
    expect(component.departmentCount()).toBe(0);
    expect(component.loyaltyDeals()).toBe(0);
  });

  it('should compute totalDeals from deals signal', () => {
    deals.set([makeDeal({ dealId: '1' }), makeDeal({ dealId: '2' })]);
    const fixture = setup();
    expect(fixture.componentInstance.totalDeals()).toBe(2);
  });

  it('should compute storesTracked from getUserStores signal', () => {
    userStores.set([makeUserStore(), makeUserStore({ instanceId: 'safeway:def' })]);
    const fixture = setup();
    expect(fixture.componentInstance.storesTracked()).toBe(2);
  });

  it('should compute departmentCount from departments signal', () => {
    departments.set(['Produce', 'Bakery', 'Deli']);
    const fixture = setup();
    expect(fixture.componentInstance.departmentCount()).toBe(3);
  });

  it('should count only deals with loyalty truthy', () => {
    deals.set([
      makeDeal({ dealId: '1', loyalty: 'Card' }),
      makeDeal({ dealId: '2', loyalty: undefined }),
      makeDeal({ dealId: '3', loyalty: 'Digital' }),
    ]);
    const fixture = setup();
    expect(fixture.componentInstance.loyaltyDeals()).toBe(2);
  });

  it('should render 4 stat cards', () => {
    const fixture = setup();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.card');
    expect(cards.length).toBe(4);
  });

  it('should render stat values in the DOM', () => {
    deals.set([makeDeal({ dealId: '1', loyalty: 'Card' })]);
    departments.set(['Produce']);
    userStores.set([makeUserStore()]);
    const fixture = setup();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1'); // total deals, stores, departments, loyalty
  });
});
