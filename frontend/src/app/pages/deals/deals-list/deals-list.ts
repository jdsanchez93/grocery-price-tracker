import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataViewModule } from 'primeng/dataview';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectModule } from 'primeng/select';
import { Deal, LABEL_RANK } from '../../../core/models/deal.model';
import {
  getStoreAbbr,
  getStoreDisplayName,
  getStoreSeverity,
  TagSeverity,
} from '../../../core/models/store.model';
import { getLoyaltyIcon, getLoyaltyTooltip } from '../../../core/models/loyalty';
import { DealRatingBadge } from '../../../shared/components/deal-rating-badge/deal-rating-badge';

type SortKey = 'rating' | 'price-asc' | 'price-desc' | 'name' | 'store';

interface SortOption {
  value: SortKey;
  label: string;
}

const SORTERS: Record<SortKey, (a: Deal, b: Deal) => number> = {
  rating: (a, b) => {
    const ar = a.rating ? LABEL_RANK[a.rating.label] : Number.POSITIVE_INFINITY;
    const br = b.rating ? LABEL_RANK[b.rating.label] : Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    const ap = a.rating?.percentVsAvg ?? 0;
    const bp = b.rating?.percentVsAvg ?? 0;
    return ap - bp;
  },
  'price-asc': (a, b) => (a.priceNumber ?? Infinity) - (b.priceNumber ?? Infinity),
  'price-desc': (a, b) => (b.priceNumber ?? -Infinity) - (a.priceNumber ?? -Infinity),
  name: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
  store: (a, b) =>
    getStoreDisplayName(a.storeInstanceId).localeCompare(getStoreDisplayName(b.storeInstanceId)),
};

@Component({
  selector: 'app-deals-list',
  imports: [
    CurrencyPipe,
    FormsModule,
    DataViewModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SelectModule,
    DealRatingBadge,
  ],
  templateUrl: './deals-list.html',
  styleUrl: './deals-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealsList {
  deals = input.required<Deal[]>();
  loading = input(false);
  rows = input(20);
  rowsPerPageOptions = input([10, 20, 50]);
  showRating = input(false);

  searchQuery = signal('');
  sortKey = signal<SortKey | null>(null);
  expanded = signal<Set<string>>(new Set());

  sortOptions = computed<SortOption[]>(() => {
    const opts: SortOption[] = [];
    if (this.showRating()) {
      opts.push({ value: 'rating', label: 'Best rating first' });
    }
    opts.push(
      { value: 'price-asc', label: 'Price: low to high' },
      { value: 'price-desc', label: 'Price: high to low' },
      { value: 'name', label: 'Name (A–Z)' },
      { value: 'store', label: 'Store' },
    );
    return opts;
  });

  visibleDeals = computed<Deal[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const key = this.sortKey();
    let out = this.deals();
    if (q) {
      out = out.filter(d =>
        (d.name?.toLowerCase().includes(q) ?? false) ||
        (d.details?.toLowerCase().includes(q) ?? false) ||
        d.dept.toLowerCase().includes(q) ||
        getStoreDisplayName(d.storeInstanceId).toLowerCase().includes(q)
      );
    }
    if (key) {
      out = [...out].sort(SORTERS[key]);
    }
    return out;
  });

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  isExpanded(dealId: string): boolean {
    return this.expanded().has(dealId);
  }

  toggleExpand(dealId: string): void {
    this.expanded.update(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  }

  hasPerLb(deal: Deal): boolean {
    return deal.priceVariants?.some(v => v.perLb != null) ?? false;
  }

  hasAvgWeight(deal: Deal): boolean {
    return deal.priceVariants?.some(v => v.avgWeight != null) ?? false;
  }

  getStoreDisplayName(id: string): string {
    return getStoreDisplayName(id);
  }

  getStoreAbbr(id: string): string {
    return getStoreAbbr(id);
  }

  getStoreSeverity(id: string): TagSeverity {
    return getStoreSeverity(id);
  }

  getLoyaltyIcon(loyalty: string): string {
    return getLoyaltyIcon(loyalty);
  }

  getLoyaltyTooltip(loyalty: string): string {
    return getLoyaltyTooltip(loyalty);
  }
}
