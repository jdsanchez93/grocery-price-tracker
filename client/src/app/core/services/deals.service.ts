import { Injectable, signal, computed } from '@angular/core';
import { Deal, getStoreDisplayName, getStoreTypeFromInstanceId, StoreType } from '../models/deal.model';
import { MOCK_DEALS } from '../data/mock-deals';

/**
 * Service for managing deal data.
 * Currently uses mock data, will be updated to use real API calls later.
 */
@Injectable({
  providedIn: 'root'
})
export class DealsService {
  private deals = signal<Deal[]>(MOCK_DEALS);

  /**
   * Get all deals.
   */
  getDeals = computed(() => this.deals());

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
