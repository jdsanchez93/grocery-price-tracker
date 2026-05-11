import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DealColumnConfig, DealsTable } from '../deals-table/deals-table';
import { DealsList } from '../deals-list/deals-list';
import { DealsService } from '@/app/core/services/deals.service';
import { RoleService } from '@/app/core/services/role.service';
import { LayoutService } from '@/app/layout/service/layout.service';

@Component({
  selector: 'app-current-deals',
  imports: [DealsTable, DealsList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isMobile()) {
      <app-deals-list
        [deals]="deals()"
        [loading]="loading()"
        [showRating]="roles.isPowerUser()"
      />
    } @else {
      <app-deals-table
        [deals]="deals()"
        [columns]="columns()"
        [loading]="loading()"
      />
    }
  `,
})
export class CurrentDeals {
  private dealsService = inject(DealsService);
  private layoutService = inject(LayoutService);
  protected roles = inject(RoleService);

  deals = this.dealsService.deals;
  loading = this.dealsService.loading;
  isMobile = this.layoutService.isMobile$;

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
    ...(this.roles.isPowerUser() ? [{
      field: 'rating' as const,
      header: 'Rating',
      style: { width: '130px' }
    }] : []),
  ]);
}
