import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Deal, getStoreDisplayName } from '../models/deal.model';
import { environment } from '../../../environments/environment';

interface DealsResponse {
  weekId: string;
  deals: Deal[];
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class DealsService {
  private http = inject(HttpClient);

  private deals = signal<Deal[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.loadDeals();
  }

  /**
   * Load deals from the API.
   */
  loadDeals(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<DealsResponse>(`${environment.apiUrl}/me/deals`).subscribe({
      next: (response) => {
        this.deals.set(response.deals);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load deals');
        this.loading.set(false);
      }
    });
  }

  /**
   * Get all deals.
   */
  getDeals = this.deals.asReadonly();

  /**
   * Get unique store instance IDs from the deals.
   */
  getStoreInstanceIds = computed(() => {
    const ids = new Set(this.deals().map(d => d.storeInstanceId));
    return Array.from(ids);
  });

  /**
   * Get unique departments from the deals.
   */
  getDepartments = computed(() => {
    const depts = new Set(this.deals().map(d => d.dept));
    return Array.from(depts).sort();
  });

  /**
   * Get store options for dropdown filter.
   */
  getStoreOptions = computed(() => {
    return this.getStoreInstanceIds().map(id => ({
      value: id,
      label: getStoreDisplayName(id)
    }));
  });

  /**
   * Get department options for dropdown filter.
   */
  getDepartmentOptions = computed(() => {
    return this.getDepartments().map(dept => ({
      value: dept,
      label: dept
    }));
  });
}
