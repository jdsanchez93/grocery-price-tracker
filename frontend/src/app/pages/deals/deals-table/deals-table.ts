import { ChangeDetectionStrategy, Component, computed, contentChild, input, model, signal, TemplateRef } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { Deal } from '../../../core/models/deal.model';
import { getStoreAbbr, getStoreDisplayName, getStoreSeverity, TagSeverity } from '../../../core/models/store.model';
import { getLoyaltyIcon, getLoyaltyTooltip } from '../../../core/models/loyalty';
import { DealRatingBadge } from '../../../shared/components/deal-rating-badge/deal-rating-badge';

export type DealColumnField = 'image' | 'store' | 'name' | 'dept' | 'priceDisplay' | 'quantity' | 'loyalty' | 'weekId' | 'rating' | 'canonicalProductId';

export interface DealColumnConfig {
  field: DealColumnField;
  header: string;
  sortable?: boolean;
  filterType?: 'text' | 'multiselect';
  filterField?: string;
  style?: Record<string, string>;
  navigable?: boolean;
}

@Component({
  selector: 'app-deals-table',
  imports: [
    CurrencyPipe,
    NgTemplateOutlet,
    TableModule,
    MultiSelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    TooltipModule,
    ButtonModule,
    ImageModule,
    DealRatingBadge,
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
  selectable = input(false);
  selectedDeals = model<Deal[]>([]);

  rowActionsTemplate = contentChild<TemplateRef<{ $implicit: Deal }>>('rowActions');
  captionActionsTemplate = contentChild<TemplateRef<unknown>>('captionActions');

  expandedRows = signal<Record<string, boolean>>({});
  globalFilterValue = signal('');

  globalFilterFields = computed(() => {
    const fields = this.columns()
      .filter(c => c.field !== 'image')
      .map(c => c.filterField ?? (c.field === 'store' ? 'storeInstanceId' : c.field));
    if (!fields.includes('canonicalProductId')) {
      fields.push('canonicalProductId');
    }
    return fields;
  });

  hasExpandableRows = computed(() =>
    this.deals().some(d => d.priceVariants && d.priceVariants.length > 0)
  );

  /**
   * Auto-derives multiselect filter options from the current deals for any
   * column that uses filterType='multiselect'. Keyed by the effective filter 
   * field (col.filterField ?? col.field). The store column gets human-readable 
   * labels via getStoreDisplayName.
   */
  derivedFilterOptions = computed(() => {
    const result = new Map<string, { value: string; label: string }[]>();
    for (const col of this.columns()) {
      if (col.filterType !== 'multiselect') continue;
      const field = col.filterField ?? col.field;
      const seen = new Set<string>();
      const opts: { value: string; label: string }[] = [];
      for (const deal of this.deals()) {
        const raw = field === 'storeInstanceId'
          ? deal.storeInstanceId
          : String((deal as any)[field] ?? '');
        if (raw && !seen.has(raw)) {
          seen.add(raw);
          opts.push({
            value: raw,
            label: field === 'storeInstanceId' ? this.getStoreDisplayName(raw) : raw,
          });
        }
      }
      result.set(field, opts.sort((a, b) => a.label.localeCompare(b.label)));
    }
    return result;
  });

  expandedColspan = computed(() =>
    this.columns().length
    + (this.hasExpandableRows() ? 1 : 0)
    + (this.selectable() ? 1 : 0)
    + (this.rowActionsTemplate() ? 1 : 0)
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

  getStoreAbbr(instanceId: string): string {
    return getStoreAbbr(instanceId);
  }

  getLoyaltyIcon(loyalty: string): string {
    return getLoyaltyIcon(loyalty);
  }

  getLoyaltyTooltip(loyalty: string): string {
    return getLoyaltyTooltip(loyalty);
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
