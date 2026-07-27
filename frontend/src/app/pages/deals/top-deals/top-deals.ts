import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DealColumnConfig, DealsTable } from '../deals-table/deals-table';
import { DealsList } from '../deals-list/deals-list';
import { DealsService } from '@/app/core/services/deals.service';
import { LayoutService } from '@/app/layout/service/layout.service';

@Component({
  selector: 'app-top-deals',
  imports: [DealsTable, DealsList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4">
      <h1 class="font-semibold text-xl m-0">Top Deals</h1>
      <p class="text-muted-color mt-1 mb-0">
        This week's deals rated Best or Good against their price history, best first.
      </p>
    </div>
    @if (isMobile()) {
      <app-deals-list
        [deals]="topDeals()"
        [loading]="loading()"
        [showRating]="true"
      />
    } @else {
      <app-deals-table
        [deals]="topDeals()"
        [columns]="columns()"
        [loading]="loading()"
      />
    }
  `,
})
export class TopDeals {
  private dealsService = inject(DealsService);
  private layoutService = inject(LayoutService);

  topDeals = this.dealsService.topDeals;
  loading = this.dealsService.loading;
  isMobile = this.layoutService.isMobile$;

  // Route is power-user gated, so the rating column is unconditional here.
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
    },
    {
      field: 'loyalty',
      header: 'Loyalty',
      style: { width: '60px' }
    },
    {
      field: 'rating',
      header: 'Rating',
      style: { width: '130px' }
    },
  ]);
}
