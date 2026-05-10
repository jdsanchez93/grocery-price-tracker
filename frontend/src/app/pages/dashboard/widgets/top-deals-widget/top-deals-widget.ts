import { Deal, DealRating } from '@/app/core/models/deal.model';
import { DealsService } from '@/app/core/services/deals.service';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DealRatingBadge } from "@/app/shared/components/deal-rating-badge/deal-rating-badge";
import { DividerModule } from 'primeng/divider';

type RatedDeal = Deal & { rating: DealRating };

const GOOD_RATINGS: DealRating['label'][] = ['best', 'good'];
const LABEL_RANK: Record<DealRating['label'], number> = { best: 0, good: 1, typical: 2, high: 3 };

@Component({
  selector: 'app-top-deals-widget',
  imports: [DealRatingBadge, DividerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-6">Top Deals</div>
      @if (topDeals().length === 0) {
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

  topDeals = computed(() => {
    return this.dealsService.deals()
      .filter((d): d is RatedDeal => !!d.rating && GOOD_RATINGS.includes(d.rating.label))
      .sort((a, b) =>
        LABEL_RANK[a.rating.label] - LABEL_RANK[b.rating.label] || a.rating.percentVsAvg - b.rating.percentVsAvg
      );
  });
}
