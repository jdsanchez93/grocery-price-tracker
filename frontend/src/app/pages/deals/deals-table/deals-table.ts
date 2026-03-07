import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { Deal } from '../../../core/models/deal.model';
import { getStoreDisplayName, getStoreSeverity, TagSeverity } from '../../../core/models/store.model';

export type DealColumnField = 'image' | 'store' | 'name' | 'dept' | 'priceDisplay' | 'quantity' | 'loyalty';

export interface DealColumnConfig {
  field: DealColumnField;
  header: string;
  sortable?: boolean;
  filterType?: 'text' | 'multiselect';
  filterField?: string;
  filterOptions?: { value: string; label: string }[];
  style?: Record<string, string>;
}

@Component({
  selector: 'app-deals-table',
  imports: [
    CurrencyPipe,
    TableModule,
    MultiSelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    ButtonModule,
    ImageModule,
  ],
  templateUrl: './deals-table.html',
  styleUrl: './deals-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealsTable {
  deals = input.required<Deal[]>();
  columns = input.required<DealColumnConfig[]>();
  loading = input(false);
  rows = input(20);
  rowsPerPageOptions = input([10, 20, 50]);
  dataKey = input('dealId');

  expandedRows = signal<Record<string, boolean>>({});
  globalFilterValue = signal('');

  globalFilterFields = computed(() =>
    this.columns()
      .filter(c => c.field !== 'image')
      .map(c => c.filterField ?? (c.field === 'store' ? 'storeInstanceId' : c.field))
  );

  hasExpandableRows = computed(() =>
    this.deals().some(d => d.priceVariants && d.priceVariants.length > 0)
  );

  expandedColspan = computed(() =>
    this.columns().length + (this.hasExpandableRows() ? 1 : 0)
  );

  onGlobalFilter(table: Table, event: Event): void {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  expandAll(): void {
    const rows: Record<string, boolean> = {};
    for (const deal of this.deals()) {
      if (deal.priceVariants?.length) {
        rows[deal.dealId] = true;
      }
    }
    this.expandedRows.set(rows);
  }

  collapseAll(): void {
    this.expandedRows.set({});
  }

  getStoreSeverity(instanceId: string): TagSeverity {
    return getStoreSeverity(instanceId);
  }

  getStoreDisplayName(instanceId: string): string {
    return getStoreDisplayName(instanceId);
  }

  getFieldValue(deal: Deal, field: DealColumnField): string {
    const val = deal[field as keyof Deal];
    return val != null ? String(val) : '';
  }

  hasPerLb(deal: Deal): boolean {
    return deal.priceVariants?.some(v => v.perLb != null) ?? false;
  }

  hasAvgWeight(deal: Deal): boolean {
    return deal.priceVariants?.some(v => v.avgWeight != null) ?? false;
  }
}
