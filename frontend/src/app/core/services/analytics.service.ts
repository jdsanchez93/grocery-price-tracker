import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Deal } from '../models/deal.model';
import { environment } from '../../../environments/environment';

export interface ProductHistoryResponse {
  productId: string;
  history: Deal[];
  count: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private http = inject(HttpClient);

  getProductHistory(canonicalProductId: string): Observable<ProductHistoryResponse> {
    return this.http.get<ProductHistoryResponse>(
      `${environment.apiUrl}/me/products/${encodeURIComponent(canonicalProductId)}/history`
    );
  }
}
