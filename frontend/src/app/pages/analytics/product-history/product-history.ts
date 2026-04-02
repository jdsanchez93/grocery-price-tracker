import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { Deal } from '../../../core/models/deal.model';
import { DealsTable, DealColumnConfig } from '../../deals/deals-table/deals-table';
import { getStoreDisplayName } from '../../../core/models/store.model';

@Component({
  selector: 'app-product-history',
  imports: [DealsTable],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2>Price History</h2>
        <p class="product-id">Product: <code>{{ productId() }}</code></p>
      </div>

      @if (error()) {
        <div class="error-message" role="alert">{{ error() }}</div>
      } @else {
        <app-deals-table
          [deals]="history()"
          [columns]="columns()"
          [loading]="loading()"
          [rows]="20"
        />
      }
    </div>
  `,
  styles: `
    .page-container {
      padding: 1.5rem;
    }
    .page-header {
      margin-bottom: 1.5rem;
    }
    .page-header h2 {
      margin: 0 0 0.25rem;
    }
    .product-id {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .error-message {
      padding: 1rem;
      color: var(--p-red-600);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductHistory implements OnInit {
  private route = inject(ActivatedRoute);
  private analyticsService = inject(AnalyticsService);

  productId = signal('');
  history = signal<Deal[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  storeOptions = computed(() => {
    const ids = new Set(this.history().map(d => d.storeInstanceId));
    return Array.from(ids).map(id => ({ value: id, label: getStoreDisplayName(id) }));
  });

  columns = computed<DealColumnConfig[]>(() => [
    { field: 'weekId', header: 'Week', sortable: true },
    {
      field: 'store',
      header: 'Store',
      sortable: true,
      filterType: 'multiselect',
      filterField: 'storeInstanceId',
      filterOptions: this.storeOptions(),
    },
    { field: 'name', header: 'Product', sortable: true },
    { field: 'priceDisplay', header: 'Price', sortable: true },
  ]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.productId.set(id);

    this.analyticsService.getProductHistory(id).subscribe({
      next: (response) => {
        this.history.set(response.history);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load price history');
        this.loading.set(false);
      },
    });
  }
}
