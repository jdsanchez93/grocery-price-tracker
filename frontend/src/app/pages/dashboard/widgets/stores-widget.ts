import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoresService } from '@/app/core/services/stores.service';
import { DealsService } from '@/app/core/services/deals.service';
import { StoreCard } from '@/app/shared/components/store-card/store-card';

@Component({
  selector: 'app-stores-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoreCard, RouterLink],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-6">Your Stores</div>
      @if (stores().length === 0) {
        <div class="text-center py-8">
          <i class="pi pi-shop text-4xl text-muted-color mb-4" aria-hidden="true"></i>
          <p class="text-muted-color mb-4">No stores tracked yet.</p>
          <a routerLink="/user/stores" class="text-primary font-medium">Add your first store</a>
        </div>
      } @else {
        <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          @for (store of stores(); track store.instanceId) {
            <a routerLink="/deals" class="no-underline">
              <app-store-card [name]="store.name" [storeType]="store.storeType">
                <span class="text-muted-color text-sm">{{ storeDealCounts()[store.instanceId] || 0 }} deals</span>
              </app-store-card>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class StoresWidget {
  private storesService = inject(StoresService);
  private dealsService = inject(DealsService);

  stores = this.storesService.getUserStores;

  storeDealCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const deal of this.dealsService.deals()) {
      counts[deal.storeInstanceId] = (counts[deal.storeInstanceId] || 0) + 1;
    }
    return counts;
  });
}
