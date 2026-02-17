import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  UserStore,
  AvailableStore,
  UserStoresResponse,
  AvailableStoresResponse
} from '../models/store.model';
import { StoreType, STORE_TYPE_METADATA } from '../models/deal.model';

@Injectable({
  providedIn: 'root'
})
export class StoresService {
  private http = inject(HttpClient);

  private userStores = signal<UserStore[]>([]);
  private availableStores = signal<AvailableStore[]>([]);

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
  addStore(instanceId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.post(`${environment.apiUrl}/me/stores/${instanceId}`, {}).subscribe({
      next: () => {
        this.loadUserStores();
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to add store');
        this.loading.set(false);
      }
    });
  }

  /**
   * Remove a store from user's stores.
   */
  removeStore(instanceId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.delete(`${environment.apiUrl}/me/stores/${instanceId}`).subscribe({
      next: () => {
        this.loadUserStores();
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to remove store');
        this.loading.set(false);
      }
    });
  }

  /**
   * Load available stores for a store type.
   */
  loadAvailableStores(type: StoreType): void {
    this.loadingAvailable.set(true);
    this.availableStores.set([]);

    this.http.get<AvailableStoresResponse>(`${environment.apiUrl}/store-types/${type}/stores`).subscribe({
      next: (response) => {
        this.availableStores.set(response.stores);
        this.loadingAvailable.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load available stores');
        this.loadingAvailable.set(false);
      }
    });
  }

  /**
   * Clear available stores.
   */
  clearAvailableStores(): void {
    this.availableStores.set([]);
  }

  /**
   * Get user's stores.
   */
  getUserStores = this.userStores.asReadonly();

  /**
   * Get available stores.
   */
  getAvailableStores = this.availableStores.asReadonly();

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
