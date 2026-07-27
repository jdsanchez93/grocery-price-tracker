import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Deal, DealsResponse, LABEL_RANK, RatedDeal, TOP_DEAL_RATINGS } from '../models/deal.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DealsService {
  private http = inject(HttpClient);

  private _deals = signal<Deal[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  deals = this._deals.asReadonly();

  departments = computed(() => {
    const depts = new Set(this._deals().map(d => d.dept));
    return Array.from(depts).sort();
  });

  /**
   * Deals rated 'best' or 'good', ordered best-first: rating rank, then
   * discount depth (percentVsAvg ascending), then dealId so ties are stable —
   * the dashboard widget's top N is always a prefix of the top-deals page.
   */
  topDeals = computed<RatedDeal[]>(() =>
    this._deals()
      .filter((d): d is RatedDeal => !!d.rating && TOP_DEAL_RATINGS.includes(d.rating.label))
      .sort((a, b) =>
        LABEL_RANK[a.rating.label] - LABEL_RANK[b.rating.label]
        || a.rating.percentVsAvg - b.rating.percentVsAvg
        || a.dealId.localeCompare(b.dealId)
      )
  );

  constructor() {
    this.loadDeals();
  }

  /**
   * Load deals. With no weekId, the API returns each store's currently-active
   * circular ("current" mode). A weekId requests a specific historical week.
   */
  loadDeals(weekId?: string): void {
    this.loading.set(true);
    this.error.set(null);

    const params = weekId ? `?week=${weekId}` : '';
    this.http.get<DealsResponse>(`${environment.apiUrl}/me/deals${params}`).subscribe({
      next: (response) => {
        this._deals.set(response.deals);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.error.set('Upgrade your plan to browse historical weeks');
        } else {
          this.error.set(err.message || 'Failed to load deals');
        }
        this.loading.set(false);
      }
    });
  }
}
