import { Component, computed, inject } from '@angular/core';
import { DealColumnConfig, DealsTable } from "../deals-table/deals-table";
import { DealsService } from '@/app/core/services/deals.service';

@Component({
  selector: 'app-current-deals',
  imports: [DealsTable],
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
      filterOptions: this.dealsService.storeOptions()
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
      filterOptions: this.dealsService.departmentOptions()
    },
    {
      field: 'priceDisplay',
      header: 'Price',
      sortable: true
    },
    {
      field: 'loyalty',
      header: 'Loyalty',
      style: { width: '120px' }
    },
  ]);
}
