import { environment } from '@/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AvailableStore, StoreAddress, StoreType } from '../models/store.model';
import { AutoScrapeResponse, ScrapeStatusResponse } from '../models/admin.model';

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

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);

  autoScrapeStore(instanceId: string, force: boolean = false): Observable<AutoScrapeResponse> {
    return this.http.post<AutoScrapeResponse>(`${environment.apiUrl}/admin/scrape/auto`, {}, { params: { 'instanceId': instanceId, 'force': force } });
  }

  getAllStores(): Observable<AvailableStore[]> {
    return this.http.get<AvailableStore[]>(`${environment.apiUrl}/admin/stores`);
  }

  getScrapeStatus(instanceIds: string[]): Observable<ScrapeStatusResponse> {
    return this.http.get<ScrapeStatusResponse>(`${environment.apiUrl}/admin/scrape/status`, {params: {'instanceIds': instanceIds.join(',')}});
  }

  createStore(data: CreateStoreRequest): Observable<CreateStoreResponse> {
    return this.http.post<CreateStoreResponse>(`${environment.apiUrl}/admin/stores`, data);
  }

  updateStore(instanceId: string, data: UpdateStoreRequest): Observable<UpdateStoreResponse> {
    return this.http.patch<UpdateStoreResponse>(`${environment.apiUrl}/admin/stores/${instanceId}`, data);
  }
}
