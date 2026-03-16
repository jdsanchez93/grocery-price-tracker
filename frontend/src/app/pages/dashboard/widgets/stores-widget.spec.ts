import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { StoresWidget } from './stores-widget';
import { DealsService } from '@/app/core/services/deals.service';
import { StoresService } from '@/app/core/services/stores.service';
import { makeDeal } from '@/app/core/models/test-utils';
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

describe('StoresWidget', () => {
  const deals = signal<Deal[]>([]);
  const userStores = signal<UserStore[]>([]);

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: DealsService,
          useValue: { deals: deals.asReadonly() },
        },
        {
          provide: StoresService,
          useValue: { getUserStores: userStores.asReadonly() },
        },
      ],
    });
    return TestBed.createComponent(StoresWidget);
  }

  beforeEach(() => {
    deals.set([]);
    userStores.set([]);
  });

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show empty state when no stores', () => {
    const fixture = setup();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No stores tracked yet');
    expect(text).toContain('Add your first store');
  });

  it('should show store cards when stores exist', () => {
    userStores.set([makeUserStore()]);
    const fixture = setup();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('No stores tracked yet');
    expect(text).toContain('Test Store');
  });

  it('should compute deal counts per store', () => {
    deals.set([
      makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc' }),
      makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:abc' }),
      makeDeal({ dealId: '3', storeInstanceId: 'safeway:def' }),
    ]);
    const fixture = setup();
    const counts = fixture.componentInstance.storeDealCounts();
    expect(counts['kingsoopers:abc']).toBe(2);
    expect(counts['safeway:def']).toBe(1);
  });

  it('should return empty counts when no deals', () => {
    const fixture = setup();
    expect(fixture.componentInstance.storeDealCounts()).toEqual({});
  });

  it('should render deal count text for each store', () => {
    userStores.set([makeUserStore({ instanceId: 'kingsoopers:abc' })]);
    deals.set([
      makeDeal({ dealId: '1', storeInstanceId: 'kingsoopers:abc' }),
      makeDeal({ dealId: '2', storeInstanceId: 'kingsoopers:abc' }),
    ]);
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 deals');
  });

  it('should show 0 deals for store with no matching deals', () => {
    userStores.set([makeUserStore({ instanceId: 'sprouts:xyz' })]);
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0 deals');
  });

  it('should have link to /user/stores in empty state', () => {
    const fixture = setup();
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a[href="/user/stores"]');
    expect(link).toBeTruthy();
  });
});
