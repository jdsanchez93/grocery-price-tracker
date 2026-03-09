import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { DealsService } from '@/app/core/services/deals.service';
import { StoresService } from '@/app/core/services/stores.service';

@Component({
  selector: 'app-stats-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Total Deals</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ totalDeals() }}</div>
          </div>
          <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-tag text-blue-500 !text-xl" aria-hidden="true"></i>
          </div>
        </div>
        <span class="text-muted-color">This week's deals</span>
      </div>
    </div>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Stores Tracked</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ storesTracked() }}</div>
          </div>
          <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-shop text-orange-500 !text-xl" aria-hidden="true"></i>
          </div>
        </div>
        <span class="text-muted-color">Active stores</span>
      </div>
    </div>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Departments</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ departmentCount() }}</div>
          </div>
          <div class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-th-large text-cyan-500 !text-xl" aria-hidden="true"></i>
          </div>
        </div>
        <span class="text-muted-color">Unique departments</span>
      </div>
    </div>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3">
      <div class="card mb-0">
        <div class="flex justify-between mb-4">
          <div>
            <span class="block text-muted-color font-medium mb-4">Loyalty Deals</span>
            <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ loyaltyDeals() }}</div>
          </div>
          <div class="flex items-center justify-center bg-purple-100 dark:bg-purple-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
            <i class="pi pi-star text-purple-500 !text-xl" aria-hidden="true"></i>
          </div>
        </div>
        <span class="text-muted-color">Card member deals</span>
      </div>
    </div>
  `,
})
export class StatsWidget {
  private dealsService = inject(DealsService);
  private storesService = inject(StoresService);

  totalDeals = computed(() => this.dealsService.deals().length);
  storesTracked = computed(() => this.storesService.getUserStores().length);
  departmentCount = computed(() => this.dealsService.departments().length);
  loyaltyDeals = computed(() => this.dealsService.deals().filter(d => d.loyalty).length);
}
