import { DealsService } from '@/app/core/services/deals.service';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DealRatingBadge } from "@/app/shared/components/deal-rating-badge/deal-rating-badge";
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';

/** Max deals shown on the dashboard; the full list lives at /deals/top-deals. */
export const TOP_DEALS_WIDGET_LIMIT = 5;

@Component({
  selector: 'app-top-deals-widget',
  imports: [DealRatingBadge, DividerModule, SkeletonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <div class="font-semibold text-xl">Top Deals</div>
        @if (totalCount() > 0 && !loading()) {
          <a
            routerLink="/deals/top-deals"
            class="text-primary font-medium hover:underline"
          >View all {{ totalCount() }}</a>
        }
      </div>
      @if (loading()) {
        <ul class="list-none p-0" aria-busy="true" aria-label="Loading top deals">
          @for (i of [1, 2, 3]; track i; let last = $last) {
            <li class="flex flex-col gap-2">
              <p-skeleton width="14rem" height="1.25rem" />
              <p-skeleton width="8rem" height="1rem" />
            </li>
            @if (!last) {
              <p-divider />
            }
          }
        </ul>
      } @else if (topDeals().length === 0) {
        <div class="text-center py-8">
          <i class="pi pi-tag text-4xl text-muted-color mb-4" aria-hidden="true"></i>
          <p class="text-muted-color">No deals loaded yet.</p>
        </div>
      } @else {
        <ul class="list-none p-0">
          @for (d of topDeals(); track d.dealId; let last = $last) {
            <li class="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <span class="text-surface-900 dark:text-surface-0 font-medium">{{ d.name }}</span>
                <div class="mt-1 text-muted-color text-sm">{{ d.details }}</div>
                <div class="mt-1 text-muted-color">{{ d.priceDisplay }}</div>
              </div>
              <div class="mt-2 md:mt-0 ml-0 md:ml-8 flex items-center">
                <app-deal-rating-badge
                  [rating]="d.rating"
                  [productId]="d.canonicalProductId"
                  [productName]="d.name"
                />
              </div>
            </li>
            @if (!last) {
              <p-divider />
            }
          }
        </ul>
      }
    </div>`,
  styles: ``,
})
export class TopDealsWidget {
  private dealsService = inject(DealsService);

  loading = this.dealsService.loading;

  totalCount = computed(() => this.dealsService.topDeals().length);

  topDeals = computed(() => this.dealsService.topDeals().slice(0, TOP_DEALS_WIDGET_LIMIT));
}
