import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Deal, DealsResponse } from '../models/deal.model';
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
