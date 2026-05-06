import { AdminService, type Circular } from '@/app/core/services/admin.service';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { DealColumnConfig, DealsTable } from "../../deals/deals-table/deals-table";
import { DealEditDialog } from './deal-edit-dialog/deal-edit-dialog';
import { SelectModule } from 'primeng/select';
import { Deal } from '@/app/core/models/deal.model';
import { AvailableStore, StoreSelectOption, storeSelectOption } from '@/app/core/models/store.model';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FluidModule } from 'primeng/fluid';
import { ButtonModule } from 'primeng/button';

interface WeekOption {
  value: string; // weekId
  label: string;
}

function toLocalDate(dateStr: string): Date {
  // Full ISO datetime (kingsoopers): "2026-02-18T07:00:00Z" — parse as-is
  // Plain date (safeway): "2026-02-24" — append local noon to avoid UTC midnight rollover
  return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
}

function formatWeekLabel(weekId: string, startDate: string, endDate: string): string {
  const week = parseInt(weekId.split('-W')[1]);
  const fmt = (d: string) => toLocalDate(d)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week ${week} · ${fmt(startDate)} – ${fmt(endDate)}`;
}

@Component({
  selector: 'app-deals-editor',
  imports: [
    DealsTable,
    DealEditDialog,
    SelectModule,
    FormsModule,
    FluidModule,
    ButtonModule,
  ],
  templateUrl: './deals-editor.html',
  styleUrl: './deals-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DealsEditor {
  private adminService = inject(AdminService);
  private editDialog = viewChild.required(DealEditDialog);

  constructor() {
    // Store change: reset week, overrides, and selection.
    effect(() => {
      this.selectedStoreId(); // track
      untracked(() => {
        this.selectedWeekId.set(null);
        this.dealsOverrides.set(new Map());
        this.selectedDeals.set([]);
      });
    });

    // Week change: reset overrides and selection (deals are a new set).
    effect(() => {
      this.selectedWeekId(); // track
      untracked(() => {
        this.dealsOverrides.set(new Map());
        this.selectedDeals.set([]);
      });
    });

    forkJoin([this.adminService.getAllStores(), this.adminService.getAllCirculars()])
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ([stores, circulars]) => {
          this.allStores.set(stores);
          this.allCirculars.set(circulars);
          this.loadingMeta.set(false);
        },
        error: () => this.loadingMeta.set(false),
      });
  }

  selectedStoreId = signal<string | null>(null);
  selectedWeekId = signal<string | null>(null);
  selectedDeals = signal<Deal[]>([]);

  loadingMeta = signal(false);
  private dealsOverrides = signal<Map<string, Deal>>(new Map());

  allCirculars = signal<Circular[]>([]);
  allStores = signal<AvailableStore[]>([]);

  private storesById = computed(() =>
    new Map(this.allStores().map(s => [s.instanceId, s]))
  );
  storeOptions = computed<StoreSelectOption[]>(() => {
    const byId = this.storesById();
    const idsWithCircular = new Set(this.allCirculars().map(c => c.storeInstanceId));
    return [...idsWithCircular]
      .map(id => byId.get(id))
      .filter((s) => s != undefined)
      .map(storeSelectOption)
  });

  selection = computed(() => {
    const storeId = this.selectedStoreId();
    const weekId = this.selectedWeekId();
    return storeId && weekId ? { storeId, weekId } : null;
  });

  private dealsState = toSignal(
    toObservable(this.selection).pipe(
      switchMap(sel => sel
        ? this.adminService.getHistoricalDeals(sel.storeId, sel.weekId).pipe(
          map(r => ({ loading: false, deals: r.deals })),
          startWith({ loading: true, deals: [] as Deal[] }),
          catchError(() => of({ loading: false, deals: [] as Deal[] }))
        )
        : of({ loading: false, deals: [] as Deal[] })
      )
    ),
    { initialValue: { loading: false, deals: [] as Deal[] } }
  );

  deals = computed(() => {
    const overrides = this.dealsOverrides();
    return this.dealsState().deals.map(d => overrides.get(d.dealId) ?? d);
  });
  loadingDeals = computed(() => this.dealsState().loading);

  openEditDialog(deals: Deal[]): void {
    this.editDialog().open(deals);
  }

  clearSelection(): void {
    this.selectedDeals.set([]);
  }

  onDealsSaved(updatedDeals: Deal[]): void {
    this.dealsOverrides.update(map => {
      const next = new Map(map);
      for (const d of updatedDeals) next.set(d.dealId, d);
      return next;
    });
    this.selectedDeals.set([]);
  }

  columns = computed<DealColumnConfig[]>(() => [
    {
      field: 'store',
      header: 'Store',
      sortable: true,
      filterType: 'multiselect',
      filterField: 'storeInstanceId',
      style: { width: '80px' }
    },
    {
      field: 'name',
      header: 'Name',
      sortable: true,
      filterType: 'text'
    },
    {
      field: 'dept',
      header: 'Department',
      sortable: true,
      filterType: 'multiselect',
    },
    {
      field: 'priceDisplay',
      header: 'Price',
      sortable: true
    }
  ]);

  availableWeeks = computed<WeekOption[]>(() =>
    this.allCirculars()
      .filter(c => c.storeInstanceId === this.selectedStoreId())
      .map(c => ({
        value: c.weekId,
        label: formatWeekLabel(c.weekId, c.startDate, c.endDate),
      }))
      .sort((a, b) => b.value.localeCompare(a.value))
  );

}