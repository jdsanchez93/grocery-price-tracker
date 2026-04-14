import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import { DealColumnConfig, DealsTable } from "../deals-table/deals-table";
import { DealsService } from '@/app/core/services/deals.service';
import { Auth0User, ROLES_CLAIM } from '@/app/core/auth/auth.constants';

@Component({
  selector: 'app-current-deals',
  imports: [DealsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-deals-table
      [deals]="deals()"
      [columns]="columns()"
      [loading]="loading()"
      [showHistoryLink]="showHistoryLink()"
    />
  `
})
export class CurrentDeals {
  private dealsService = inject(DealsService);
  private user = toSignal(inject(AuthService).user$) as Signal<Auth0User | null | undefined>;

  private isPowerUser = computed(() => {
    const roles = this.user()?.[ROLES_CLAIM] ?? [];
    return roles.includes('power_user') || roles.includes('admin');
  });

  showHistoryLink = this.isPowerUser;

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
    ...(this.isPowerUser() ? [{
      field: 'rating' as const,
      header: 'Rating',
      style: { width: '130px' }
    }] : []),
  ]);
}
