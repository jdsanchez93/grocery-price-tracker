import { environment } from '@/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AvailableStore } from '../models/store.model';
import { AutoScrapeResponse, ScrapeStatusResponse } from '../models/admin.model';



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
}
