import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal, computed } from '@angular/core';
import { DealsService } from './deals.service';
import { AvailableStore, UserStore, UserStoresResponse, StoreType, AvailableStoresResponse, STORE_TYPE_METADATA } from '../models/store.model';
import { environment } from '@/environments/environment';
import { catchError, finalize, Observable, switchMap, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StoresService {
  private http = inject(HttpClient);
  private dealsService = inject(DealsService);

  private userStores = signal<UserStore[]>([]);
  private allAvailableStores = signal<AvailableStore[]>([]);

  loading = signal(false);
  loadingAvailable = signal(false);
  error = signal<string | null>(null);

  constructor() {
    this.loadUserStores();
  }

  /**
   * Load user's stores from the API.
   */
  loadUserStores(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<UserStoresResponse>(`${environment.apiUrl}/me/stores`).subscribe({
      next: (response) => {
        this.userStores.set(response.stores);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load stores');
        this.loading.set(false);
      }
    });
  }

  /**
   * Add a store to user's stores.
   */
  addStore(instanceId: string): Observable<UserStoresResponse> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.post<void>(`${environment.apiUrl}/me/stores/${instanceId}`, {}).pipe(
      switchMap(() => this.http.get<UserStoresResponse>(`${environment.apiUrl}/me/stores`)),
      tap((response) => {
        this.userStores.set(response.stores);
        this.dealsService.loadDeals();
      }),
      catchError((err) => {
        this.error.set(err.message || 'Failed to add store');
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  /**
   * Remove a store from user's stores.
   */
  removeStore(instanceId: string): Observable<UserStoresResponse> {
    this.error.set(null);

    const removed = this.userStores().find(s => s.instanceId === instanceId);
    this.userStores.update(stores => stores.filter(s => s.instanceId !== instanceId));

    return this.http.delete<void>(`${environment.apiUrl}/me/stores/${instanceId}`).pipe(
      switchMap(() => this.http.get<UserStoresResponse>(`${environment.apiUrl}/me/stores`)),
      tap((response) => {
        this.userStores.set(response.stores);
        this.dealsService.loadDeals();
      }),
      catchError((err) => {
        if (removed) {
          this.userStores.update(stores => [...stores, removed]);
        }
        this.error.set(err.message || 'Failed to remove store');
        return throwError(() => err);
      }),
    );
  }

  /**
   * Load all available stores (idempotent — no-op if already loaded or in flight).
   */
  loadAllStores(): void {
    if (this.allAvailableStores().length > 0 || this.loadingAvailable()) {
      return;
    }
    this.loadingAvailable.set(true);

    this.http.get<AvailableStoresResponse>(`${environment.apiUrl}/stores`).subscribe({
      next: (response) => {
        this.allAvailableStores.set(response.stores);
        this.loadingAvailable.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load available stores');
        this.loadingAvailable.set(false);
      }
    });
  }

  /**
   * Get available stores filtered by type (in-memory, after loadAllStores).
   */
  getAvailableStoresByType(type: StoreType): AvailableStore[] {
    return this.allAvailableStores().filter(s => s.storeType === type);
  }

  /**
   * Get user's stores.
   */
  getUserStores = this.userStores.asReadonly();

  /**
   * Get available stores (all types).
   */
  getAvailableStores = this.allAvailableStores.asReadonly();

  /**
   * Get user's stores grouped by store type.
   */
  getStoresGroupedByType = computed(() => {
    const stores = this.userStores();
    const grouped = new Map<StoreType, UserStore[]>();

    for (const store of stores) {
      const existing = grouped.get(store.storeType) || [];
      grouped.set(store.storeType, [...existing, store]);
    }

    return grouped;
  });

  /**
   * Get store types that the user already has.
   */
  getUserStoreTypes = computed(() => {
    return new Set(this.userStores().map(s => s.storeType));
  });

  /**
   * Get available store type options (types user doesn't have yet).
   */
  getAvailableStoreTypeOptions = computed(() => {
    const userTypes = this.getUserStoreTypes();
    const allTypes: StoreType[] = ['kingsoopers', 'safeway', 'sprouts'];

    return allTypes.map(type => ({
      value: type,
      label: STORE_TYPE_METADATA[type].name,
      disabled: userTypes.has(type)
    }));
  });
}
