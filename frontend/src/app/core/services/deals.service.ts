import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Deal, DealsResponse } from '../models/deal.model';
import { getStoreDisplayName } from '../models/store.model';
import { environment } from '../../../environments/environment';

interface WeekResponse {
  weekId: string;
}

@Injectable({
  providedIn: 'root'
})
export class DealsService {
  private http = inject(HttpClient);

  private _deals = signal<Deal[]>([]);
  private _currentWeekId = signal<string | null>(null);
  private _selectedWeekId = signal<string | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  deals = this._deals.asReadonly();
  currentWeekId = this._currentWeekId.asReadonly();
  selectedWeekId = this._selectedWeekId.asReadonly();

  isCurrentWeek = computed(() =>
    this._currentWeekId() !== null &&
    this._currentWeekId() === this._selectedWeekId()
  );

  storeInstanceIds = computed(() => {
    const ids = new Set(this._deals().map(d => d.storeInstanceId));
    return Array.from(ids);
  });

  departments = computed(() => {
    const depts = new Set(this._deals().map(d => d.dept));
    return Array.from(depts).sort();
  });

  storeOptions = computed(() => {
    return this.storeInstanceIds().map(id => ({
      value: id,
      label: getStoreDisplayName(id)
    }));
  });

  departmentOptions = computed(() => {
    return this.departments().map(dept => ({
      value: dept,
      label: dept
    }));
  });

  constructor() {
    this.http.get<WeekResponse>(`${environment.apiUrl}/me/week`).subscribe({
      next: ({ weekId }) => {
        this._currentWeekId.set(weekId);
        this.loadDeals(weekId);
      },
      error: () => this.loadDeals()
    });
  }

  loadDeals(weekId?: string): void {
    this.loading.set(true);
    this.error.set(null);

    const params = weekId ? `?week=${weekId}` : '';
    this.http.get<DealsResponse>(`${environment.apiUrl}/me/deals${params}`).subscribe({
      next: (response) => {
        this._deals.set(response.deals);
        if (!this._currentWeekId()) {
          this._currentWeekId.set(response.weekId);
        }
        if (!this._selectedWeekId()) {
          this._selectedWeekId.set(response.weekId);
        }
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

  selectWeek(weekId: string): void {
    this._selectedWeekId.set(weekId);
    this.loadDeals(weekId);
  }

  selectCurrentWeek(): void {
    const current = this._currentWeekId();
    if (current) {
      this.selectWeek(current);
    }
  }
}
