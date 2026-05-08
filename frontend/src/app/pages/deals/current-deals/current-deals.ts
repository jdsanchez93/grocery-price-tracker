import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { DealColumnConfig, DealsTable } from "../deals-table/deals-table";
import { DealsService } from '@/app/core/services/deals.service';
import { RoleService } from '@/app/core/services/role.service';

@Component({
  selector: 'app-current-deals',
  imports: [DealsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-deals-table
      [deals]="deals()"
      [columns]="columns()"
      [loading]="loading()"
    />
  `
})
export class CurrentDeals {
  private dealsService = inject(DealsService);
  private roles = inject(RoleService);

  deals = this.dealsService.deals;

  loading = this.dealsService.loading;

  columns = computed<DealColumnConfig[]>(() => [
    // {
    //   field: 'image',
    //   header: '',
    //   style: { width: '60px' }
    // },
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
