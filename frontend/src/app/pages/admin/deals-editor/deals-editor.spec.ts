import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { DealsEditor } from './deals-editor';
import { AdminService, Circular } from '@/app/core/services/admin.service';
import { AvailableStore } from '@/app/core/models/store.model';
import { Deal } from '@/app/core/models/deal.model';
import { MessageService } from 'primeng/api';
import { Component, input } from '@angular/core';
import { DealColumnConfig, DealsTable } from '../../deals/deals-table/deals-table';

@Component({
  selector: 'app-deals-table',
  template: '',
})
class StubDealsTable {
  deals = input.required<Deal[]>();
  columns = input.required<DealColumnConfig[]>();
  loading = input(false);
}
// ── fixtures ──────────────────────────────────────────────────────────────────

const mockStores: AvailableStore[] = [
  { instanceId: 'kingsoopers:abc', name: 'King Soopers Pearl', storeType: 'kingsoopers', identifiers: {} as any, enabled: true },
  { instanceId: 'safeway:xyz', name: 'Safeway Broadway', storeType: 'safeway', identifiers: {} as any, enabled: true },
  { instanceId: 'sprouts:zzz', name: 'Sprouts Boulder', storeType: 'sprouts', identifiers: {} as any, enabled: true },
];

const mockCirculars: Circular[] = [
  { storeInstanceId: 'kingsoopers:abc', weekId: '2026-W17', dealCount: 120, startDate: '2026-04-22', endDate: '2026-04-28' },
  { storeInstanceId: 'kingsoopers:abc', weekId: '2026-W16', dealCount: 110, startDate: '2026-04-15', endDate: '2026-04-21' },
  { storeInstanceId: 'safeway:xyz', weekId: '2026-W17', dealCount: 95, startDate: '2026-04-22', endDate: '2026-04-28' },
];

const mockDeal: Deal = {
  dealId: 'deal001',
  storeInstanceId: 'kingsoopers:abc',
  weekId: '2026-W17',
  name: 'Coca Cola',
  details: undefined,
  dept: 'beverages',
  priceDisplay: '$5.99',
  priceNumber: 5.99,
  quantity: 1,
  loyalty: undefined,
  image: undefined,
};

function makeAdminService(overrides: Partial<Record<keyof AdminService, unknown>> = {}) {
  return {
    getAllStores: vi.fn().mockReturnValue(of(mockStores)),
    getAllCirculars: vi.fn().mockReturnValue(of(mockCirculars)),
    getHistoricalDeals: vi.fn().mockReturnValue(of({ weekId: '2026-W17', deals: [mockDeal], count: 1 })),
    ...overrides,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function create(adminService = makeAdminService()) {
  await TestBed.configureTestingModule({
    imports: [DealsEditor],
    providers: [
      { provide: AdminService, useValue: adminService },
      MessageService,
    ],
  })
    .overrideComponent(DealsEditor, {
      remove: { imports: [DealsTable] },
      add: { imports: [StubDealsTable] },
    })
    .compileComponents();

  const fixture: ComponentFixture<DealsEditor> = TestBed.createComponent(DealsEditor);
  const component = fixture.componentInstance;
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component, adminService };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DealsEditor', () => {
  it('should create', async () => {
    const { component } = await create();
    expect(component).toBeTruthy();
  });

  // ── meta loading ────────────────────────────────────────────────────────────

  describe('meta loading', () => {
    it('fetches stores and circulars on construction', async () => {
      const svc = makeAdminService();
      await create(svc);
      expect(svc.getAllStores).toHaveBeenCalledOnce();
      expect(svc.getAllCirculars).toHaveBeenCalledOnce();
    });

    it('sets loadingMeta to false after successful fetch', async () => {
      const { component } = await create();
      expect(component.loadingMeta()).toBe(false);
    });

    it('sets loadingMeta to false when fetch errors', async () => {
      const svc = makeAdminService({
        getAllStores: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      });
      const { component } = await create(svc);
      expect(component.loadingMeta()).toBe(false);
    });

    it('populates allStores and allCirculars signals', async () => {
      const { component } = await create();
      expect(component.allStores()).toEqual(mockStores);
      expect(component.allCirculars()).toEqual(mockCirculars);
    });
  });

  // ── storeOptions ────────────────────────────────────────────────────────────

  describe('storeOptions', () => {
    it('only includes stores that have at least one circular', async () => {
      const { component } = await create();
      const ids = component.storeOptions().map(o => o.value);
      expect(ids).toContain('kingsoopers:abc');
      expect(ids).toContain('safeway:xyz');
      expect(ids).not.toContain('sprouts:zzz'); // no circular for sprouts
    });

    it('uses store name in the label', async () => {
      const { component } = await create();
      const ks = component.storeOptions().find(o => o.value === 'kingsoopers:abc');
      expect(ks?.label).toContain('King Soopers Pearl');
    });

    it('returns empty array when there are no circulars', async () => {
      const svc = makeAdminService({ getAllCirculars: vi.fn().mockReturnValue(of([])) });
      const { component } = await create(svc);
      expect(component.storeOptions()).toEqual([]);
    });
  });

  // ── availableWeeks ──────────────────────────────────────────────────────────

  describe('availableWeeks', () => {
    it('returns empty array when no store is selected', async () => {
      const { component } = await create();
      expect(component.availableWeeks()).toEqual([]);
    });

    it('returns weeks only for the selected store', async () => {
      const { component } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      const weeks = component.availableWeeks().map(w => w.value);
      expect(weeks).toContain('2026-W17');
      expect(weeks).toContain('2026-W16');
      expect(weeks).not.toContain('safeway:xyz');
    });

    it('sorts weeks descending so most recent is first', async () => {
      const { component } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      const weeks = component.availableWeeks().map(w => w.value);
      expect(weeks).toEqual(['2026-W17', '2026-W16']);
    });

    it('formats labels as "Week N · Mon DD – Mon DD"', async () => {
      const { component } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      const w17 = component.availableWeeks().find(w => w.value === '2026-W17');
      expect(w17?.label).toMatch(/^Week 17 · /);
      expect(w17?.label).toContain('–');
    });
  });

  // ── store → week reset ──────────────────────────────────────────────────────

  describe('store change resets week', () => {
    it('clears selectedWeekId when selectedStoreId changes', async () => {
      const { component, fixture } = await create();
      // Two-step: set store → flush reset effect → set week → change store → flush
      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // reset effect fires (weekId already null, no-op)
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges(); // selection is now valid

      component.selectedStoreId.set('safeway:xyz');
      fixture.detectChanges(); // reset effect fires → weekId cleared
      await fixture.whenStable();

      expect(component.selectedWeekId()).toBeNull();
    });
  });

  // ── selection ───────────────────────────────────────────────────────────────

  describe('selection computed', () => {
    it('is null when no store is selected', async () => {
      const { component } = await create();
      expect(component.selection()).toBeNull();
    });

    it('is null when store is selected but no week', async () => {
      const { component } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      expect(component.selection()).toBeNull();
    });

    it('returns storeId and weekId when both are selected', async () => {
      const { component } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      component.selectedWeekId.set('2026-W17');
      expect(component.selection()).toEqual({ storeId: 'kingsoopers:abc', weekId: '2026-W17' });
    });
  });

  // ── deals pipeline ──────────────────────────────────────────────────────────

  describe('deals pipeline', () => {
    it('deals is empty and not loading when selection is null', async () => {
      const { component } = await create();
      expect(component.deals()).toEqual([]);
      expect(component.loadingDeals()).toBe(false);
    });

    it('calls getHistoricalDeals when selection becomes valid', async () => {
      const { component, adminService, fixture } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // flush reset effect first
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(adminService.getHistoricalDeals).toHaveBeenCalledWith('kingsoopers:abc', '2026-W17');
    });

    it('populates deals on successful fetch', async () => {
      const { component, fixture } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // flush reset effect first
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.deals()).toEqual([mockDeal]);
    });

    it('sets deals to empty array on fetch error', async () => {
      const svc = makeAdminService({
        getHistoricalDeals: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      });
      const { component, fixture } = await create(svc);
      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // flush reset effect first
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.deals()).toEqual([]);
      expect(component.loadingDeals()).toBe(false);
    });

    it('clears deals when selection is reset to null', async () => {
      const { component, fixture } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // flush reset effect first
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges();
      await fixture.whenStable();
      // deals should now be populated
      expect(component.deals()).toEqual([mockDeal]);

      component.selectedWeekId.set(null);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.deals()).toEqual([]);
    });

    it('cancels in-flight request when selection changes (switchMap)', async () => {
      const slow$ = new Subject<{ weekId: string; deals: Deal[]; count: number }>();
      const svc = makeAdminService({
        getHistoricalDeals: vi.fn()
          .mockReturnValueOnce(slow$)
          .mockReturnValue(of({ weekId: '2026-W16', deals: [], count: 0 })),
      });
      const { component, fixture } = await create(svc);

      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // flush reset effect
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges(); // slow$ subscribed

      // Change selection before slow$ emits — switchMap cancels the W17 request
      component.selectedWeekId.set('2026-W16');
      fixture.detectChanges();
      await fixture.whenStable();

      // Emit the stale W17 response — should be ignored (unsubscribed by switchMap)
      slow$.next({ weekId: '2026-W17', deals: [mockDeal], count: 1 });
      slow$.complete();
      fixture.detectChanges();

      expect(component.deals()).toEqual([]);
    });
  });

  // ── template ────────────────────────────────────────────────────────────────

  describe('template', () => {
    it('does not render deals table when selection is null', async () => {
      const { fixture } = await create();
      expect(fixture.debugElement.query(By.css('app-deals-table'))).toBeNull();
    });

    it('renders deals table when selection is valid', async () => {
      const { component, fixture } = await create();
      component.selectedStoreId.set('kingsoopers:abc');
      fixture.detectChanges(); // flush reset effect
      component.selectedWeekId.set('2026-W17');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.debugElement.query(By.css('app-deals-table'))).toBeTruthy();
    });

    it('disables week select when no store is selected', async () => {
      const { fixture } = await create();
      // p-select uses signal inputs; $disabled is the resolved computed from BaseEditableHolder
      const selects = fixture.debugElement.queryAll(By.css('p-select'));
      const weekInstance = selects[1]?.componentInstance;
      expect(weekInstance?.$disabled()).toBe(true);
    });

    it('disables store select while meta is loading', async () => {
      const { component, fixture } = await create();
      component.loadingMeta.set(true);
      fixture.detectChanges();

      const [storeSelectDe] = fixture.debugElement.queryAll(By.css('p-select'));
      expect(storeSelectDe.componentInstance.$disabled()).toBe(true);
    });
  });
});
