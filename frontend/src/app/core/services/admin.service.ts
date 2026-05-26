import { environment } from '@/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AvailableStore, StoreAddress, StoreType } from '../models/store.model';
import { AutoScrapeResponse, PreviewAvailabilityResponse, ScrapeStatusResponse } from '../models/admin.model';
import { Deal, DealsResponse } from '../models/deal.model';

export interface CreateStoreRequest {
  type: StoreType;
  name: string;
  storeId: string;
  facilityId?: string;
  postalCode?: string;
  address?: StoreAddress;
}

export interface CreateStoreResponse {
  success: boolean;
  store: AvailableStore;
}

export interface UpdateStoreRequest {
  name: string;
  address?: StoreAddress;
}

export interface UpdateStoreResponse {
  success: boolean;
  store: AvailableStore;
}

export interface Circular {
  storeInstanceId: string;
  weekId: string;
  dealCount: number;
  startDate: string;
  endDate: string;
}
export interface CircularResponse {
  circulars: Circular[];
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);

  autoScrapeStore(instanceId: string, force: boolean = false): Observable<AutoScrapeResponse> {
    return this.http.post<AutoScrapeResponse>(`${environment.apiUrl}/admin/scrape/auto`, {}, { params: { 'instanceId': instanceId, 'force': force } });
  }

  getAllStores(): Observable<AvailableStore[]> {
    return this.http.get<{ stores: AvailableStore[] }>(`${environment.apiUrl}/stores`).pipe(
      map(response => response.stores)
    );
  }

  getScrapeStatus(instanceIds: string[]): Observable<ScrapeStatusResponse> {
    return this.http.get<ScrapeStatusResponse>(`${environment.apiUrl}/admin/scrape/status`, { params: { 'instanceIds': instanceIds.join(',') } });
  }

  /**
   * Read-only peek: asks upstream whether each store's "next week" circular
   * has been published yet. Writes nothing to DDB.
   */
  checkPreviewAvailability(instanceIds: string[]): Observable<PreviewAvailabilityResponse> {
    return this.http.get<PreviewAvailabilityResponse>(
      `${environment.apiUrl}/admin/scrape/preview-availability`,
      { params: { instanceIds: instanceIds.join(',') } }
    );
  }

  createStore(data: CreateStoreRequest): Observable<CreateStoreResponse> {
    return this.http.post<CreateStoreResponse>(`${environment.apiUrl}/admin/stores`, data);
  }

  updateStore(instanceId: string, data: UpdateStoreRequest): Observable<UpdateStoreResponse> {
    return this.http.patch<UpdateStoreResponse>(`${environment.apiUrl}/admin/stores/${instanceId}`, data);
  }

  getHistoricalDeals(instanceId: string, weekId: string): Observable<DealsResponse> {
    return this.http.get<DealsResponse>(`${environment.apiUrl}/admin/deals/${instanceId}/${weekId}`);
  }

  getAllCirculars(): Observable<Circular[]> {
    return this.http.get<CircularResponse>(`${environment.apiUrl}/admin/circulars`).pipe(
      map(response => response.circulars)
    );
  }

  updateDeal(
    instanceId: string,
    weekId: string,
    dealId: string,
    body: { canonicalProductId?: string; dept?: string }
  ): Observable<Deal> {
    return this.http
      .patch<{ deal: Deal }>(
        `${environment.apiUrl}/admin/deals/${instanceId}/${weekId}/${dealId}`,
        body
      )
      .pipe(map(r => r.deal));
  }
}
